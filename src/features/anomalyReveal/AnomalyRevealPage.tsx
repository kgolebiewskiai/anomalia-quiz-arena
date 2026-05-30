import { useEffect, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { AppLayout } from '../../components/layout/AppLayout'
import { AnomalyBanner } from '../../components/cards/AnomalyBanner'
import { supabase } from '../../services/supabaseClient'
import { useAuthStore } from '../../store/authStore'
import { ANOMALIES } from '../../data/anomalies'
import type { Room } from '../../domain/types'
import type { RealtimeChannel } from '@supabase/supabase-js'

function useCountdownMs(startedAt: string | null, durationMs: number | null): number {
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

export function AnomalyRevealPage() {
  const { code } = useParams<{ code: string }>()
  const navigate = useNavigate()
  const { session } = useAuthStore()

  const [room, setRoom] = useState<Room | null>(null)
  const [loading, setLoading] = useState(true)

  const channelRef = useRef<RealtimeChannel | null>(null)
  const advancedRef = useRef(false)

  const msLeft = useCountdownMs(
    room?.current_phase_started_at ?? null,
    room?.current_phase_duration_ms ?? null,
  )
  const secondsLeft = Math.ceil(msLeft / 1000)

  const anomaly = room?.active_anomaly_id
    ? ANOMALIES.find((a) => a.id === room.active_anomaly_id) ?? null
    : null

  // Navigate when room status changes
  useEffect(() => {
    if (!room) return
    if (room.status === 'question') navigate(`/question/${code}`)
    if (room.status === 'modification_draft') navigate(`/modification-draft/${code}`)
    if (room.status === 'results') navigate(`/question/${code}`)
    if (room.status === 'finished') navigate(`/scoreboard/${code}`)
    if (room.status === 'lobby') navigate(`/lobby/${code}`)
  }, [room?.status, code, navigate])

  // Auto-advance when countdown hits 0
  useEffect(() => {
    if (msLeft === 0 && room?.id && !advancedRef.current && room.status === 'anomaly_reveal') {
      advancedRef.current = true
      supabase.rpc('advance_room_phase', { p_room_id: room.id }).then(null, () => {})
    }
  }, [msLeft, room?.id, room?.status])

  // Initial load
  useEffect(() => {
    if (!code || !session) return

    async function load() {
      setLoading(true)
      const { data } = await supabase
        .from('rooms')
        .select('*')
        .eq('code', code!.toUpperCase())
        .single()
      if (data) setRoom(data as Room)
      setLoading(false)
    }

    load()
  }, [code, session])

  // Realtime subscription
  useEffect(() => {
    if (!room?.id) return

    const channel = supabase
      .channel(`anomaly-reveal:${room.id}`)
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'rooms', filter: `id=eq.${room.id}` },
        (payload) => setRoom(payload.new as Room),
      )
      .subscribe()

    channelRef.current = channel
    return () => { channel.unsubscribe() }
  }, [room?.id])

  if (loading) {
    return (
      <AppLayout>
        <div className="flex flex-1 items-center justify-center">
          <p className="text-sm text-anomaly-lavender/40 animate-pulse">Ładowanie…</p>
        </div>
      </AppLayout>
    )
  }

  return (
    <AppLayout>
      <div className="flex flex-1 flex-col items-center justify-center gap-8 py-8">
        {/* Header */}
        <div className="text-center space-y-1">
          <p className="text-xs tracking-widest text-anomaly-gold uppercase">
            Anomalia aktywna
          </p>
          <p className="text-sm text-anomaly-lavender/50">
            Pytanie {room?.current_question_index} · efekt obowiązuje przez całe pytanie
          </p>
        </div>

        {/* Banner */}
        {anomaly ? (
          <div className="w-full">
            <AnomalyBanner anomaly={anomaly} questionIndex={room?.current_question_index} />
          </div>
        ) : (
          <div className="rounded-2xl border border-anomaly-lavender/20 bg-anomaly-lavender/5 px-5 py-6 text-center text-sm text-anomaly-lavender/50">
            Anomalia…
          </div>
        )}

        {/* Countdown */}
        <div className="flex flex-col items-center gap-1">
          <span className="font-mono text-5xl font-bold tabular-nums text-anomaly-primary leading-none">
            {secondsLeft}
          </span>
          <span className="text-xs text-anomaly-lavender/40">pytanie startuje za chwilę</span>
        </div>
      </div>
    </AppLayout>
  )
}
