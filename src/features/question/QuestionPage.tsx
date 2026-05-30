import { useEffect, useRef, useState, useCallback } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { AppLayout } from '../../components/layout/AppLayout'
import { supabase } from '../../services/supabaseClient'
import { useAuthStore } from '../../store/authStore'
import { cn } from '../../lib/cn'
import type {
  Room,
  RoomPlayer,
  RoomQuestion,
  Answer,
  AnswerBreakdown,
  QuestionOption,
} from '../../domain/types'
import type { RealtimeChannel } from '@supabase/supabase-js'

function useCountdown(startedAt: string | null, durationMs: number | null): number {
  const [msLeft, setMsLeft] = useState(() => {
    if (!startedAt || !durationMs) return 0
    return Math.max(0, new Date(startedAt).getTime() + durationMs - Date.now())
  })

  useEffect(() => {
    if (!startedAt || !durationMs) return
    const end = new Date(startedAt).getTime() + durationMs

    const tick = () => setMsLeft(Math.max(0, end - Date.now()))
    tick()
    const id = setInterval(tick, 100)
    return () => clearInterval(id)
  }, [startedAt, durationMs])

  return msLeft
}

export function QuestionPage() {
  const { code } = useParams<{ code: string }>()
  const navigate = useNavigate()
  const { session } = useAuthStore()

  const [room, setRoom] = useState<Room | null>(null)
  const [players, setPlayers] = useState<RoomPlayer[]>([])
  const [roomQuestion, setRoomQuestion] = useState<RoomQuestion | null>(null)
  const [myAnswer, setMyAnswer] = useState<Answer | null>(null)
  const [allAnswers, setAllAnswers] = useState<Answer[]>([])
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const channelRef = useRef<RealtimeChannel | null>(null)
  const advancedRef = useRef(false)
  const loadedQuestionRef = useRef(0)

  const msLeft = useCountdown(
    room?.current_phase_started_at ?? null,
    room?.current_phase_duration_ms ?? null,
  )
  const secondsLeft = Math.ceil(msLeft / 1000)

  // Navigate based on room status
  useEffect(() => {
    if (!room) return
    if (room.status === 'finished') navigate(`/scoreboard/${code}`)
    if (room.status === 'lobby') navigate(`/lobby/${code}`)
    if (room.status === 'category_vote') navigate(`/category-vote/${code}`)
    if (room.status === 'profile_draft') navigate(`/profile-draft/${code}`)
    if (room.status === 'modification_draft') navigate(`/modification-draft/${code}`)
    if (room.status === 'anomaly_reveal') navigate(`/anomaly-reveal/${code}`)
  }, [room?.status, code, navigate])

  // Auto-advance when timer hits 0
  useEffect(() => {
    if (
      msLeft === 0 &&
      room?.id &&
      !advancedRef.current &&
      (room.status === 'question' || room.status === 'results')
    ) {
      advancedRef.current = true
      supabase.rpc('advance_room_phase', { p_room_id: room.id }).then(null, () => {})
    }
  }, [msLeft, room?.id, room?.status])

  // Reset advance guard on phase/question change
  useEffect(() => {
    advancedRef.current = false
  }, [room?.status, room?.current_question_index])

  // Load question when question index changes
  const loadQuestion = useCallback(
    async (roomId: string, qIdx: number) => {
      if (loadedQuestionRef.current === qIdx) return
      loadedQuestionRef.current = qIdx

      setMyAnswer(null)
      setAllAnswers([])

      const { data, error: err } = await supabase
        .from('room_questions')
        .select('*, questions(*)')
        .eq('room_id', roomId)
        .eq('question_index', qIdx)
        .single()

      if (!err && data) {
        setRoomQuestion(data as RoomQuestion)
      }

      // Check if I've already answered (page refresh case)
      if (session?.user.id) {
        const { data: myAns } = await supabase
          .from('answers')
          .select('*')
          .eq('room_id', roomId)
          .eq('user_id', session.user.id)
          .eq('question_index', qIdx)
          .single()
        if (myAns) setMyAnswer(myAns as Answer)
      }
    },
    [session?.user.id],
  )

  // Load all answers for the results phase
  const loadAllAnswers = useCallback(async (roomId: string, qIdx: number) => {
    const { data } = await supabase
      .from('answers')
      .select('*')
      .eq('room_id', roomId)
      .eq('question_index', qIdx)

    if (data) setAllAnswers(data as Answer[])
  }, [])

  // Initial load
  useEffect(() => {
    if (!code || !session) return

    async function load() {
      setLoading(true)

      const { data: roomData, error: roomErr } = await supabase
        .from('rooms')
        .select('*')
        .eq('code', code!.toUpperCase())
        .single()

      if (roomErr || !roomData) {
        setError('Nie znaleziono pokoju.')
        setLoading(false)
        return
      }

      const r = roomData as Room
      setRoom(r)

      const { data: playersData } = await supabase
        .from('room_players')
        .select('*')
        .eq('room_id', r.id)
        .is('left_at', null)
        .order('score', { ascending: false })

      if (playersData) setPlayers(playersData as RoomPlayer[])

      if (r.current_question_index > 0) {
        await loadQuestion(r.id, r.current_question_index)
      }

      if (r.status === 'results' && r.current_question_index > 0) {
        await loadAllAnswers(r.id, r.current_question_index)
      }

      setLoading(false)
    }

    load()
  }, [code, session, loadQuestion, loadAllAnswers])

  // Load question when index changes (real-time driven)
  useEffect(() => {
    if (!room?.id || !room.current_question_index) return
    loadQuestion(room.id, room.current_question_index)
  }, [room?.id, room?.current_question_index, loadQuestion])

  // Load all answers when entering results phase
  useEffect(() => {
    if (!room?.id || room.status !== 'results' || !room.current_question_index) return
    loadAllAnswers(room.id, room.current_question_index)
  }, [room?.id, room?.status, room?.current_question_index, loadAllAnswers])

  // Realtime subscriptions
  useEffect(() => {
    if (!room?.id) return

    const channel = supabase
      .channel(`question:${room.id}`)
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'rooms', filter: `id=eq.${room.id}` },
        (payload) => setRoom(payload.new as Room),
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'room_players', filter: `room_id=eq.${room.id}` },
        (payload) => {
          const updated = payload.new as RoomPlayer
          setPlayers((prev) =>
            prev
              .map((p) => (p.user_id === updated.user_id ? updated : p))
              .sort((a, b) => b.score - a.score),
          )
        },
      )
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'answers', filter: `room_id=eq.${room.id}` },
        (payload) => {
          const ans = payload.new as Answer
          setAllAnswers((prev) => {
            if (prev.find((a) => a.id === ans.id)) return prev
            return [...prev, ans]
          })
        },
      )
      .subscribe()

    channelRef.current = channel
    return () => {
      channel.unsubscribe()
    }
  }, [room?.id])

  async function handleAnswer(optionId: string) {
    if (!room || !session || submitting || myAnswer !== null) return
    setSubmitting(true)
    setError(null)

    const { data, error: rpcErr } = await supabase.rpc('submit_answer', {
      p_room_id: room.id,
      p_question_index: room.current_question_index,
      p_answer: { id: optionId },
    })

    if (rpcErr) {
      if (rpcErr.message?.includes('ALREADY_ANSWERED')) {
        // Race condition — already answered, just mark so
      } else if (rpcErr.message?.includes('TIME_EXPIRED') || rpcErr.message?.includes('WRONG_PHASE')) {
        setError('Czas minął — odpowiedź nie została przyjęta.')
      } else {
        setError('Błąd przy wysyłaniu odpowiedzi.')
      }
    } else if (data) {
      const breakdown = data as AnswerBreakdown
      const fakeAnswer: Answer = {
        id: 'local',
        room_id: room.id,
        user_id: session.user.id,
        question_index: room.current_question_index,
        question_id: roomQuestion?.question_id ?? '',
        answer: { id: optionId },
        is_correct: breakdown.total > 0 || (breakdown.lines[0]?.value ?? 0) > 0,
        answered_at: new Date().toISOString(),
        response_ms: 0,
        base_points: breakdown.lines[0]?.value ?? 0,
        speed_bonus: breakdown.lines[1]?.value ?? 0,
        flat_bonus: 0,
        multiplier: 1,
        penalty: 0,
        total_points: breakdown.total,
        breakdown,
      }
      setMyAnswer(fakeAnswer)
    }

    setSubmitting(false)
  }

  // ─── helpers ───────────────────────────────────────────────────────────────

  const activePlayers = players.filter((p) => p.left_at === null)
  const answeredCount = allAnswers.length

  const q = roomQuestion?.questions ?? null
  const options: QuestionOption[] = q?.options ?? []

  const myCorrectAnswer =
    myAnswer && q
      ? (myAnswer.answer as { id?: string }).id === (q.correct_answer as { id?: string }).id
      : null

  // ─── render helpers ─────────────────────────────────────────────────────────

  if (loading) {
    return (
      <AppLayout>
        <div className="flex flex-1 items-center justify-center">
          <p className="text-sm text-anomaly-lavender/40 animate-pulse">Ładowanie pytania…</p>
        </div>
      </AppLayout>
    )
  }

  if (error && !room) {
    return (
      <AppLayout>
        <div className="flex flex-1 flex-col items-center justify-center gap-4">
          <p className="text-sm text-red-400">{error}</p>
          <button onClick={() => navigate('/')} className="text-xs text-anomaly-lavender/50 hover:text-anomaly-lavender/80 transition-colors">
            ← Strona główna
          </button>
        </div>
      </AppLayout>
    )
  }

  if (!room) return null

  // ─── Results phase ──────────────────────────────────────────────────────────
  if (room.status === 'results') {
    return <ResultsView
      room={room}
      players={activePlayers}
      myAnswer={myAnswer}
      myCorrectAnswer={myCorrectAnswer}
      secondsLeft={secondsLeft}
      sessionUserId={session?.user.id ?? ''}
    />
  }

  // ─── Question phase ─────────────────────────────────────────────────────────
  const timerPct = room.current_phase_duration_ms
    ? msLeft / room.current_phase_duration_ms
    : 0

  return (
    <AppLayout>
      <div className="flex flex-1 flex-col gap-5 py-6">
        {/* Header row */}
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs tracking-widest text-anomaly-gold uppercase">
              Test · Pytanie {room.current_question_index}/12
            </p>
            {q && (
              <p className="text-xs text-anomaly-lavender/50 mt-0.5 capitalize">
                {q.difficulty === 'easy' ? 'łatwe' : q.difficulty === 'medium' ? 'średnie' : 'trudne'}
              </p>
            )}
          </div>

          {/* Timer */}
          <div className="relative flex flex-col items-center">
            <span
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
            </span>
            <div className="mt-1 h-1 w-16 rounded-full bg-white/10 overflow-hidden">
              <div
                className={cn(
                  'h-full rounded-full transition-all duration-100',
                  secondsLeft <= 5 ? 'bg-red-400' : 'bg-anomaly-primary',
                )}
                style={{ width: `${Math.max(0, timerPct * 100)}%` }}
              />
            </div>
          </div>
        </div>

        {/* Question text */}
        <div className="rounded-2xl border border-anomaly-primary/20 bg-anomaly-primary/5 px-5 py-6">
          <p className="text-lg font-semibold text-anomaly-lavender leading-snug">
            {q?.question_text ?? '…'}
          </p>
        </div>

        {/* Answer options */}
        {myAnswer === null ? (
          <div className={cn('grid gap-3', options.length <= 2 ? 'grid-cols-1' : 'grid-cols-2')}>
            {options.map((opt) => (
              <button
                key={opt.id}
                onClick={() => handleAnswer(opt.id)}
                disabled={submitting || msLeft === 0}
                className={cn(
                  'rounded-2xl border-2 border-anomaly-primary/30 bg-anomaly-primary/10',
                  'px-4 py-5 text-left text-sm font-medium text-anomaly-lavender',
                  'transition-all active:scale-95',
                  'hover:border-anomaly-primary hover:bg-anomaly-primary/20',
                  'disabled:opacity-40 disabled:pointer-events-none',
                )}
              >
                <span className="text-xs text-anomaly-primary/60 block mb-1">{opt.id}</span>
                {opt.text}
              </button>
            ))}
          </div>
        ) : (
          <div className="flex flex-1 flex-col items-center justify-center gap-3">
            <div
              className={cn(
                'rounded-2xl border-2 px-6 py-4 text-center',
                myCorrectAnswer
                  ? 'border-green-500/40 bg-green-500/10 text-green-400'
                  : 'border-red-500/40 bg-red-500/10 text-red-400',
              )}
            >
              <p className="text-2xl font-bold mb-1">{myCorrectAnswer ? '✓' : '✗'}</p>
              <p className="text-sm font-medium">{myCorrectAnswer ? 'Poprawna odpowiedź!' : 'Błędna odpowiedź'}</p>
              <p className={cn('text-lg font-bold mt-1', myAnswer.total_points >= 0 ? 'text-anomaly-gold' : 'text-red-400')}>
                {myAnswer.total_points >= 0 ? '+' : ''}{myAnswer.total_points} pkt
              </p>
            </div>
            <p className="text-xs text-anomaly-lavender/40 animate-pulse">
              Czekaj na wyniki…
            </p>
          </div>
        )}

        {/* Answer progress */}
        <div className="flex items-center justify-center gap-2 text-xs text-anomaly-lavender/40">
          <span>Odpowiedziało:</span>
          <span className="text-anomaly-lavender font-semibold">
            {answeredCount}/{activePlayers.length}
          </span>
        </div>

        {error && <p className="text-center text-xs text-red-400">{error}</p>}
      </div>
    </AppLayout>
  )
}

// ─── Results sub-view ─────────────────────────────────────────────────────────

interface ResultsViewProps {
  room: Room
  players: RoomPlayer[]
  myAnswer: Answer | null
  myCorrectAnswer: boolean | null
  secondsLeft: number
  sessionUserId: string
}

function ResultsView({
  room,
  players,
  myAnswer,
  myCorrectAnswer,
  secondsLeft,
  sessionUserId,
}: ResultsViewProps) {
  return (
    <AppLayout>
      <div className="flex flex-1 flex-col gap-5 py-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs tracking-widest text-anomaly-gold uppercase">
              Wyniki · Pytanie {room.current_question_index}/12
            </p>
            <h1 className="text-2xl font-bold text-anomaly-primary">Rundowe wyniki</h1>
          </div>
          <div className="flex flex-col items-center">
            <span className="font-mono text-2xl font-bold tabular-nums text-anomaly-primary">{secondsLeft}s</span>
            <span className="text-xs text-anomaly-lavender/40">do następnego</span>
          </div>
        </div>

        {/* My result */}
        {myAnswer ? (
          <div
            className={cn(
              'rounded-2xl border-2 px-5 py-4',
              myCorrectAnswer
                ? 'border-green-500/40 bg-green-500/10'
                : 'border-red-500/40 bg-red-500/10',
            )}
          >
            <p className={cn('text-sm font-semibold mb-2', myCorrectAnswer ? 'text-green-400' : 'text-red-400')}>
              {myCorrectAnswer ? '✓ Poprawna odpowiedź' : '✗ Błędna odpowiedź'}
            </p>
            <div className="space-y-1">
              {myAnswer.breakdown.lines.map((line, i) => (
                <div key={i} className="flex items-center justify-between text-sm">
                  <span className="text-anomaly-lavender/70">{line.label}</span>
                  <span className={cn('font-mono font-semibold', line.value >= 0 ? 'text-anomaly-gold' : 'text-red-400')}>
                    {line.value >= 0 ? '+' : ''}{line.value}
                  </span>
                </div>
              ))}
              <div className="mt-2 flex items-center justify-between border-t border-white/10 pt-2 text-sm font-bold">
                <span className="text-anomaly-lavender">Razem</span>
                <span className={cn('font-mono', myAnswer.breakdown.total >= 0 ? 'text-anomaly-gold' : 'text-red-400')}>
                  {myAnswer.breakdown.total >= 0 ? '+' : ''}{myAnswer.breakdown.total}
                </span>
              </div>
            </div>
          </div>
        ) : (
          <div className="rounded-2xl border border-anomaly-lavender/20 bg-anomaly-lavender/5 px-5 py-4 text-center text-sm text-anomaly-lavender/50">
            Nie odpowiedziałeś na to pytanie — 0 pkt
          </div>
        )}

        {/* Scoreboard */}
        <div>
          <p className="text-xs tracking-widest text-anomaly-lavender/40 uppercase mb-2">Tabela wyników</p>
          <div className="space-y-2">
            {players
              .slice()
              .sort((a, b) => b.score - a.score)
              .map((p, idx) => (
                <div
                  key={p.user_id}
                  className={cn(
                    'flex items-center justify-between rounded-xl border px-4 py-3',
                    p.user_id === sessionUserId
                      ? 'border-anomaly-primary/40 bg-anomaly-primary/10'
                      : 'border-white/10 bg-white/5',
                  )}
                >
                  <div className="flex items-center gap-3">
                    <span className={cn(
                      'text-xs font-bold w-5 text-center',
                      idx === 0 ? 'text-anomaly-gold' : 'text-anomaly-lavender/40',
                    )}>
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
                    {p.score} pkt
                  </span>
                </div>
              ))}
          </div>
        </div>
      </div>
    </AppLayout>
  )
}
