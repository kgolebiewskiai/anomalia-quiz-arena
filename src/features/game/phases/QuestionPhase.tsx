import { useCallback, useEffect, useRef, useState } from 'react'
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import type { RealtimeChannel } from '@supabase/supabase-js'
import { supabase } from '../../../services/supabaseClient'
import { cn } from '../../../lib/cn'
import { Stagger, StaggerItem } from '../../../components/motion/Stagger'
import { CountUp } from '../../../components/ui/CountUp'
import type {
  Answer,
  AnswerBreakdown,
  QuestionOption,
  RoomQuestion,
} from '../../../domain/types'
import { useGame } from '../gameContext'

export function QuestionPhase() {
  const { room, players, session, msLeft, secondsLeft } = useGame()

  const [roomQuestion, setRoomQuestion] = useState<RoomQuestion | null>(null)
  const [myAnswer, setMyAnswer] = useState<Answer | null>(null)
  const [allAnswers, setAllAnswers] = useState<Answer[]>([])
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const channelRef = useRef<RealtimeChannel | null>(null)
  const qIdx = room.current_question_index

  // Load the question + my existing answer (covers refresh mid-question).
  useEffect(() => {
    let cancelled = false
    async function load() {
      const { data } = await supabase
        .from('room_questions')
        .select('*, questions(*)')
        .eq('room_id', room.id)
        .eq('question_index', qIdx)
        .single()
      if (!cancelled && data) setRoomQuestion(data as RoomQuestion)

      const { data: myAns } = await supabase
        .from('answers')
        .select('*')
        .eq('room_id', room.id)
        .eq('user_id', session.user.id)
        .eq('question_index', qIdx)
        .single()
      if (!cancelled && myAns) setMyAnswer(myAns as Answer)
    }
    load()
    return () => {
      cancelled = true
    }
  }, [room.id, qIdx, session.user.id])

  // Load all answers once we reach results.
  useEffect(() => {
    if (room.status !== 'results') return
    let cancelled = false
    supabase
      .from('answers')
      .select('*')
      .eq('room_id', room.id)
      .eq('question_index', qIdx)
      .then(({ data }) => {
        if (!cancelled && data) setAllAnswers(data as Answer[])
      })
    return () => {
      cancelled = true
    }
  }, [room.status, room.id, qIdx])

  // Live answer count.
  useEffect(() => {
    const channel = supabase
      .channel(`answers:${room.id}:${qIdx}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'answers', filter: `room_id=eq.${room.id}` },
        (payload) => {
          const ans = payload.new as Answer
          if (ans.question_index !== qIdx) return
          setAllAnswers((prev) => (prev.some((a) => a.id === ans.id) ? prev : [...prev, ans]))
        },
      )
      .subscribe()
    channelRef.current = channel
    return () => {
      channel.unsubscribe()
    }
  }, [room.id, qIdx])

  const handleAnswer = useCallback(
    async (optionId: string) => {
      if (submitting || myAnswer !== null) return
      setSubmitting(true)
      setError(null)

      const { data, error: rpcErr } = await supabase.rpc('submit_answer', {
        p_room_id: room.id,
        p_question_index: qIdx,
        p_answer: { id: optionId },
      })

      if (rpcErr) {
        if (rpcErr.message?.includes('ALREADY_ANSWERED')) {
          // race — already answered
        } else if (
          rpcErr.message?.includes('TIME_EXPIRED') ||
          rpcErr.message?.includes('WRONG_PHASE')
        ) {
          setError('Czas minął — odpowiedź nie została przyjęta.')
        } else {
          setError('Błąd przy wysyłaniu odpowiedzi.')
        }
      } else if (data) {
        const breakdown = data as AnswerBreakdown
        const isCorrectLocally =
          !breakdown.blocked && (breakdown.total > 0 || (breakdown.lines[0]?.value ?? 0) > 0)
        setMyAnswer({
          id: 'local',
          room_id: room.id,
          user_id: session.user.id,
          question_index: qIdx,
          question_id: roomQuestion?.question_id ?? '',
          answer: { id: optionId },
          is_correct: isCorrectLocally,
          answered_at: new Date().toISOString(),
          response_ms: 0,
          base_points: breakdown.lines[0]?.value ?? 0,
          speed_bonus: breakdown.lines[1]?.value ?? 0,
          flat_bonus: 0,
          multiplier: 1,
          penalty: 0,
          total_points: breakdown.total,
          breakdown,
        })
      }
      setSubmitting(false)
    },
    [submitting, myAnswer, room.id, qIdx, session.user.id, roomQuestion?.question_id],
  )

  const q = roomQuestion?.questions ?? null
  const options: QuestionOption[] = q?.options ?? []
  const activePlayers = players.filter((p) => p.left_at === null)
  const myCorrectAnswer =
    myAnswer && q
      ? (myAnswer.answer as { id?: string }).id === (q.correct_answer as { id?: string }).id
      : null

  return (
    <AnimatePresence mode="wait">
      {room.status === 'results' ? (
        <ResultsBody
          key="results"
          qIdx={qIdx}
          secondsLeft={secondsLeft}
          players={activePlayers}
          myAnswer={myAnswer}
          myCorrectAnswer={myCorrectAnswer}
          sessionUserId={session.user.id}
        />
      ) : (
        <QuestionBody
          key="question"
          qIdx={qIdx}
          secondsLeft={secondsLeft}
          timerPct={room.current_phase_duration_ms ? msLeft / room.current_phase_duration_ms : 0}
          questionText={q?.question_text ?? '…'}
          difficulty={q?.difficulty}
          options={options}
          myAnswer={myAnswer}
          myCorrectAnswer={myCorrectAnswer}
          submitting={submitting}
          timeUp={msLeft === 0}
          answeredCount={allAnswers.length}
          totalCount={activePlayers.length}
          error={error}
          onAnswer={handleAnswer}
        />
      )}
    </AnimatePresence>
  )
}

// ─── Question (answering) body ──────────────────────────────────────────────

interface QuestionBodyProps {
  qIdx: number
  secondsLeft: number
  timerPct: number
  questionText: string
  difficulty?: string
  options: QuestionOption[]
  myAnswer: Answer | null
  myCorrectAnswer: boolean | null
  submitting: boolean
  timeUp: boolean
  answeredCount: number
  totalCount: number
  error: string | null
  onAnswer: (optionId: string) => void
}

function QuestionBody({
  qIdx,
  secondsLeft,
  timerPct,
  questionText,
  difficulty,
  options,
  myAnswer,
  myCorrectAnswer,
  submitting,
  timeUp,
  answeredCount,
  totalCount,
  error,
  onAnswer,
}: QuestionBodyProps) {
  const reduce = useReducedMotion()
  return (
    <motion.div
      className="flex flex-1 flex-col gap-5 py-6"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.2 }}
    >
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs tracking-widest text-anomaly-gold uppercase">
            Test · Pytanie {qIdx}/12
          </p>
          {difficulty && (
            <p className="text-xs text-anomaly-lavender/50 mt-0.5 capitalize">
              {difficulty === 'easy' ? 'łatwe' : difficulty === 'medium' ? 'średnie' : 'trudne'}
            </p>
          )}
        </div>

        <div className="relative flex flex-col items-center">
          <motion.span
            key={secondsLeft <= 5 ? 'urgent' : 'normal'}
            animate={secondsLeft <= 5 && !reduce ? { scale: [1, 1.18, 1] } : { scale: 1 }}
            transition={{ duration: 0.5, repeat: secondsLeft <= 5 ? Infinity : 0 }}
            className={cn(
              'font-mono text-4xl font-bold tabular-nums leading-none',
              secondsLeft <= 5
                ? 'text-red-400'
                : secondsLeft <= 10
                  ? 'text-anomaly-gold'
                  : 'text-anomaly-primary',
            )}
          >
            {secondsLeft}
          </motion.span>
          <div className="mt-1 h-1 w-16 rounded-full bg-white/10 overflow-hidden">
            <div
              className={cn(
                'h-full rounded-full transition-[width] duration-100 ease-linear',
                secondsLeft <= 5 ? 'bg-red-400' : 'bg-anomaly-primary',
              )}
              style={{ width: `${Math.max(0, timerPct * 100)}%` }}
            />
          </div>
        </div>
      </div>

      <div className="rounded-2xl border border-anomaly-primary/20 bg-anomaly-primary/5 px-5 py-6">
        <p className="text-lg font-semibold text-anomaly-lavender leading-snug">{questionText}</p>
      </div>

      {myAnswer === null ? (
        <Stagger className={cn('grid gap-3', options.length <= 2 ? 'grid-cols-1' : 'grid-cols-2')}>
          {options.map((opt) => (
            <StaggerItem key={opt.id}>
              <button
                onClick={() => onAnswer(opt.id)}
                disabled={submitting || timeUp}
                className={cn(
                  'w-full rounded-2xl border-2 border-anomaly-primary/30 bg-anomaly-primary/10',
                  'px-4 py-5 text-left text-sm font-medium text-anomaly-lavender',
                  'transition-all active:scale-95',
                  'hover:border-anomaly-primary hover:bg-anomaly-primary/20',
                  'disabled:opacity-40 disabled:pointer-events-none',
                )}
              >
                <span className="text-xs text-anomaly-primary/60 block mb-1">{opt.id}</span>
                {opt.text}
              </button>
            </StaggerItem>
          ))}
        </Stagger>
      ) : (
        <motion.div
          className="flex flex-1 flex-col items-center justify-center gap-3"
          initial={{ opacity: 0, scale: reduce ? 1 : 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ type: 'spring', stiffness: 320, damping: 22 }}
        >
          {myAnswer.breakdown.blocked ? (
            <div className="rounded-2xl border-2 border-anomaly-lavender/30 bg-anomaly-lavender/5 px-6 py-4 text-center">
              <p className="text-2xl font-bold mb-1 text-anomaly-lavender/60">⏸</p>
              <p className="text-sm font-medium text-anomaly-lavender/70">Opóźniona Reakcja</p>
              <p className="text-xs text-anomaly-lavender/50 mt-1">
                Modyfikacja blokuje punkty w tym pytaniu
              </p>
              <p className="text-lg font-bold mt-2 text-anomaly-lavender/40">+0 pkt</p>
            </div>
          ) : (
            <div
              className={cn(
                'rounded-2xl border-2 px-6 py-4 text-center',
                myCorrectAnswer
                  ? 'border-green-500/40 bg-green-500/10 text-green-400'
                  : 'border-red-500/40 bg-red-500/10 text-red-400',
              )}
            >
              <p className="text-2xl font-bold mb-1">{myCorrectAnswer ? '✓' : '✗'}</p>
              <p className="text-sm font-medium">
                {myCorrectAnswer ? 'Poprawna odpowiedź!' : 'Błędna odpowiedź'}
              </p>
              <p
                className={cn(
                  'text-lg font-bold mt-1',
                  myAnswer.total_points >= 0 ? 'text-anomaly-gold' : 'text-red-400',
                )}
              >
                {myAnswer.total_points >= 0 ? '+' : ''}
                {myAnswer.total_points} pkt
              </p>
            </div>
          )}
          <p className="text-xs text-anomaly-lavender/40 animate-pulse">Czekaj na wyniki…</p>
        </motion.div>
      )}

      <div className="flex items-center justify-center gap-2 text-xs text-anomaly-lavender/40">
        <span>Odpowiedziało:</span>
        <span className="text-anomaly-lavender font-semibold">
          {answeredCount}/{totalCount}
        </span>
      </div>

      {error && <p className="text-center text-xs text-red-400">{error}</p>}
    </motion.div>
  )
}

// ─── Results body (staggered breakdown + FLIP scoreboard) ───────────────────

interface ResultsBodyProps {
  qIdx: number
  secondsLeft: number
  players: ReturnType<typeof useGame>['players']
  myAnswer: Answer | null
  myCorrectAnswer: boolean | null
  sessionUserId: string
}

function ResultsBody({
  qIdx,
  secondsLeft,
  players,
  myAnswer,
  myCorrectAnswer,
  sessionUserId,
}: ResultsBodyProps) {
  const sorted = players.slice().sort((a, b) => b.score - a.score)
  return (
    <motion.div
      className="flex flex-1 flex-col gap-5 py-6"
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.26, ease: [0.22, 1, 0.36, 1] }}
    >
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs tracking-widest text-anomaly-gold uppercase">
            Wyniki · Pytanie {qIdx}/12
          </p>
          <h1 className="text-2xl font-bold text-anomaly-primary">Rundowe wyniki</h1>
        </div>
        <div className="flex flex-col items-center">
          <span className="font-mono text-2xl font-bold tabular-nums text-anomaly-primary">
            {secondsLeft}s
          </span>
          <span className="text-xs text-anomaly-lavender/40">do następnego</span>
        </div>
      </div>

      {myAnswer ? (
        <div
          className={cn(
            'rounded-2xl border-2 px-5 py-4',
            myCorrectAnswer ? 'border-green-500/40 bg-green-500/10' : 'border-red-500/40 bg-red-500/10',
          )}
        >
          <p
            className={cn(
              'text-sm font-semibold mb-2',
              myCorrectAnswer ? 'text-green-400' : 'text-red-400',
            )}
          >
            {myCorrectAnswer ? '✓ Poprawna odpowiedź' : '✗ Błędna odpowiedź'}
          </p>
          <Stagger className="space-y-1">
            {myAnswer.breakdown.lines.map((line, i) => (
              <StaggerItem key={i}>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-anomaly-lavender/70">{line.label}</span>
                  <span
                    className={cn(
                      'font-mono font-semibold',
                      line.value >= 0 ? 'text-anomaly-gold' : 'text-red-400',
                    )}
                  >
                    {line.value >= 0 ? '+' : ''}
                    {line.value}
                  </span>
                </div>
              </StaggerItem>
            ))}
            <StaggerItem>
              <div className="mt-2 flex items-center justify-between border-t border-white/10 pt-2 text-sm font-bold">
                <span className="text-anomaly-lavender">Razem</span>
                <CountUp
                  value={myAnswer.breakdown.total}
                  showSign
                  className={cn(
                    'font-mono',
                    myAnswer.breakdown.total >= 0 ? 'text-anomaly-gold' : 'text-red-400',
                  )}
                />
              </div>
            </StaggerItem>
          </Stagger>
        </div>
      ) : (
        <div className="rounded-2xl border border-anomaly-lavender/20 bg-anomaly-lavender/5 px-5 py-4 text-center text-sm text-anomaly-lavender/50">
          Nie odpowiedziałeś na to pytanie — 0 pkt
        </div>
      )}

      <div>
        <p className="text-xs tracking-widest text-anomaly-lavender/40 uppercase mb-2">
          Tabela wyników
        </p>
        <div className="space-y-2">
          {sorted.map((p, idx) => (
            <motion.div
              key={p.user_id}
              layout
              transition={{ type: 'spring', stiffness: 500, damping: 40 }}
              className={cn(
                'flex items-center justify-between rounded-xl border px-4 py-3',
                p.user_id === sessionUserId
                  ? 'border-anomaly-primary/40 bg-anomaly-primary/10'
                  : 'border-white/10 bg-white/5',
              )}
            >
              <div className="flex items-center gap-3">
                <span
                  className={cn(
                    'text-xs font-bold w-5 text-center',
                    idx === 0 ? 'text-anomaly-gold' : 'text-anomaly-lavender/40',
                  )}
                >
                  {idx + 1}
                </span>
                <span className="text-sm font-medium text-anomaly-lavender">
                  {p.display_name}
                  {p.user_id === sessionUserId && (
                    <span className="ml-1 text-xs text-anomaly-primary">(ty)</span>
                  )}
                </span>
              </div>
              <span className="font-mono text-sm font-bold text-anomaly-gold">
                <CountUp value={p.score} /> pkt
              </span>
            </motion.div>
          ))}
        </div>
      </div>
    </motion.div>
  )
}
