import { useEffect, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { AnimatePresence } from 'framer-motion'
import type { RealtimeChannel } from '@supabase/supabase-js'
import { AppLayout } from '../../components/layout/AppLayout'
import { PhaseTransition } from '../../components/motion/PhaseTransition'
import { supabase } from '../../services/supabaseClient'
import { useAuthStore } from '../../store/authStore'
import { useCountdown } from '../../hooks/useCountdown'
import type { Room, RoomPlayer } from '../../domain/types'
import { GameContext } from './gameContext'
import { CategoryVoteView } from './phases/CategoryVoteView'
import { ProfileDraftView } from './phases/ProfileDraftView'
import { QuestionPhase } from './phases/QuestionPhase'
import { AnomalyRevealView } from './phases/AnomalyRevealView'
import { ModificationDraftView } from './phases/ModificationDraftView'

/**
 * Single in-game shell. Owns the one room + players state and the one realtime
 * subscription for the whole match, so phases never remount/refetch — they just
 * cross-fade. Previously each phase was its own route that re-fetched the room on
 * mount, which produced a loading-spinner flash on every transition.
 */
export function GamePage() {
  const { code } = useParams<{ code: string }>()
  const navigate = useNavigate()
  const { session } = useAuthStore()

  const [room, setRoom] = useState<Room | null>(null)
  const [players, setPlayers] = useState<RoomPlayer[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const channelRef = useRef<RealtimeChannel | null>(null)
  const firedRef = useRef('')

  const { msLeft, secondsLeft } = useCountdown(
    room?.current_phase_started_at ?? null,
    room?.current_phase_duration_ms ?? null,
  )

  // ── Initial load ────────────────────────────────────────────────────────────
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

      setRoom(roomData as Room)

      const { data: playersData } = await supabase
        .from('room_players')
        .select('*')
        .eq('room_id', (roomData as Room).id)
        .is('left_at', null)
        .order('score', { ascending: false })

      if (playersData) setPlayers(playersData as RoomPlayer[])
      setLoading(false)
    }

    load()
  }, [code, session])

  // ── One realtime subscription for the whole match ────────────────────────────
  useEffect(() => {
    if (!room?.id) return

    const channel = supabase
      .channel(`game:${room.id}`)
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'rooms', filter: `id=eq.${room.id}` },
        (payload) => setRoom(payload.new as Room),
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'room_players', filter: `room_id=eq.${room.id}` },
        (payload) => {
          const updated = payload.new as RoomPlayer
          setPlayers((prev) => {
            const exists = prev.some((p) => p.user_id === updated.user_id)
            const next = exists
              ? prev.map((p) => (p.user_id === updated.user_id ? updated : p))
              : [...prev, updated]
            return next.sort((a, b) => b.score - a.score)
          })
        },
      )
      .subscribe()

    channelRef.current = channel
    return () => {
      channel.unsubscribe()
    }
  }, [room?.id])

  // ── Leave the shell for non-in-game statuses ─────────────────────────────────
  useEffect(() => {
    if (!room) return
    if (room.status === 'finished') {
      navigate(`/scoreboard/${code}`, { replace: true })
    } else if (room.status === 'lobby') {
      navigate(`/lobby/${code}`, { replace: true })
    }
  }, [room?.status, code, navigate])

  // ── Central auto-advance / timeout fallback (one place for every phase) ───────
  useEffect(() => {
    if (!room?.id || !room.current_phase_started_at || !room.current_phase_duration_ms) return
    if (msLeft > 0) return
    const elapsed = Date.now() - new Date(room.current_phase_started_at).getTime()
    if (elapsed < room.current_phase_duration_ms) return

    const key = `${room.status}:${room.current_question_index}`
    if (firedRef.current === key) return
    firedRef.current = key

    const swallow = () => {}
    switch (room.status) {
      case 'category_vote':
        supabase.rpc('prepare_profile_draft', { p_room_id: room.id }).then(null, swallow)
        break
      case 'profile_draft':
        supabase.rpc('prepare_questions', { p_room_id: room.id }).then(null, swallow)
        break
      case 'modification_draft':
        supabase
          .rpc('prepare_modification_draft', {
            p_room_id: room.id,
            p_draft_stage: room.current_question_index,
          })
          .then(null, swallow)
        break
      case 'question':
      case 'results':
      case 'anomaly_reveal':
        supabase.rpc('advance_room_phase', { p_room_id: room.id }).then(null, swallow)
        break
    }
  }, [
    msLeft,
    room?.id,
    room?.status,
    room?.current_question_index,
    room?.current_phase_started_at,
    room?.current_phase_duration_ms,
  ])

  // ── Render ────────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <AppLayout>
        <div className="flex flex-1 items-center justify-center">
          <p className="text-sm text-anomaly-lavender/40 animate-pulse">Ładowanie…</p>
        </div>
      </AppLayout>
    )
  }

  if (error || !room || !session) {
    return (
      <AppLayout>
        <div className="flex flex-1 flex-col items-center justify-center gap-4">
          <p className="text-sm text-red-400">{error ?? 'Nieznany błąd.'}</p>
          <button
            onClick={() => navigate('/')}
            className="text-xs text-anomaly-lavender/50 hover:text-anomaly-lavender/80 transition-colors"
          >
            ← Strona główna
          </button>
        </div>
      </AppLayout>
    )
  }

  // Question and results share a key (and the same QuestionPhase component) so the
  // answer → results flip is an internal cross-fade with no question refetch.
  const viewKey = (() => {
    switch (room.status) {
      case 'question':
      case 'results':
        return `q:${room.current_question_index}`
      case 'anomaly_reveal':
        return `anomaly:${room.current_question_index}`
      case 'modification_draft':
        return `mod:${room.current_question_index}`
      default:
        return room.status
    }
  })()

  const renderPhase = () => {
    switch (room.status) {
      case 'category_vote':
        return <CategoryVoteView />
      case 'profile_draft':
        return <ProfileDraftView />
      case 'question':
      case 'results':
        return <QuestionPhase />
      case 'anomaly_reveal':
        return <AnomalyRevealView />
      case 'modification_draft':
        return <ModificationDraftView />
      default:
        return null
    }
  }

  return (
    <GameContext.Provider
      value={{ room, players, session, code: code ?? '', msLeft, secondsLeft }}
    >
      <AppLayout>
        <AnimatePresence mode="wait">
          <PhaseTransition key={viewKey} className="flex min-h-full flex-1 flex-col">
            {renderPhase()}
          </PhaseTransition>
        </AnimatePresence>
      </AppLayout>
    </GameContext.Provider>
  )
}
