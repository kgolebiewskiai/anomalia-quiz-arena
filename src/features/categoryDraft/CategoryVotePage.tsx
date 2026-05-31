import { useEffect, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { AppLayout } from '../../components/layout/AppLayout'
import { supabase } from '../../services/supabaseClient'
import { useAuthStore } from '../../store/authStore'
import { cn } from '../../lib/cn'
import type { Category, Room, RoomPlayer } from '../../domain/types'
import type { RealtimeChannel } from '@supabase/supabase-js'

function useCountdown(startedAt: string | null, durationMs: number | null): number {
  const [secondsLeft, setSecondsLeft] = useState(() => {
    if (!startedAt || !durationMs) return 0
    const end = new Date(startedAt).getTime() + durationMs
    return Math.max(0, Math.ceil((end - Date.now()) / 1000))
  })

  useEffect(() => {
    if (!startedAt || !durationMs) return
    const end = new Date(startedAt).getTime() + durationMs

    const tick = () => {
      const left = Math.max(0, Math.ceil((end - Date.now()) / 1000))
      setSecondsLeft(left)
    }

    tick()
    const id = setInterval(tick, 500)
    return () => clearInterval(id)
  }, [startedAt, durationMs])

  return secondsLeft
}

export function CategoryVotePage() {
  const { code } = useParams<{ code: string }>()
  const navigate = useNavigate()
  const { session } = useAuthStore()

  const [room, setRoom] = useState<Room | null>(null)
  const [players, setPlayers] = useState<RoomPlayer[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [myVoteId, setMyVoteId] = useState<string | null>(null)
  const [voteCount, setVoteCount] = useState(0)
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const channelRef = useRef<RealtimeChannel | null>(null)
  const timerFiredRef = useRef(false)

  const secondsLeft = useCountdown(
    room?.current_phase_started_at ?? null,
    room?.current_phase_duration_ms ?? null,
  )

  // Navigate based on room status
  useEffect(() => {
    if (!room) return
    if (room.status === 'lobby') navigate(`/lobby/${code}`)
    if (room.status === 'profile_draft') navigate(`/profile-draft/${code}`)
  }, [room?.status, code, navigate])

  // Fire timeout RPC when countdown hits 0.
  // Guard against initial secondsLeft=0 before room data arrives (same pattern as AnomalyRevealPage).
  useEffect(() => {
    if (secondsLeft !== 0 || room?.status !== 'category_vote' || timerFiredRef.current) return
    if (!room.current_phase_started_at || !room.current_phase_duration_ms) return
    const elapsed = Date.now() - new Date(room.current_phase_started_at).getTime()
    if (elapsed < room.current_phase_duration_ms) return
    timerFiredRef.current = true
    supabase.rpc('prepare_profile_draft', { p_room_id: room.id })
  }, [secondsLeft, room?.status, room?.id, room?.current_phase_started_at, room?.current_phase_duration_ms])

  // Initial data load
  useEffect(() => {
    if (!code || !session) return

    async function load() {
      setLoading(true)
      setError(null)

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

      const [playersRes, catsRes, votesRes] = await Promise.all([
        supabase
          .from('room_players')
          .select('*')
          .eq('room_id', roomData.id)
          .is('left_at', null)
          .order('slot'),
        supabase.from('categories').select('*').eq('is_enabled', true).order('name'),
        supabase
          .from('room_category_votes')
          .select('*')
          .eq('room_id', roomData.id),
      ])

      if (!playersRes.error && playersRes.data) setPlayers(playersRes.data as RoomPlayer[])
      if (!catsRes.error && catsRes.data) setCategories(catsRes.data as Category[])
      if (!votesRes.error && votesRes.data) {
        setVoteCount(votesRes.data.length)
        const myVote = votesRes.data.find(
          (v: { user_id: string; category_id: string }) => v.user_id === session?.user.id,
        )
        if (myVote) setMyVoteId(myVote.category_id)
      }

      setLoading(false)
    }

    load()
  }, [code, session])

  // Realtime subscriptions
  useEffect(() => {
    if (!room?.id) return

    const channel = supabase
      .channel(`category-vote:${room.id}`)
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'rooms', filter: `id=eq.${room.id}` },
        (payload) => setRoom(payload.new as Room),
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'room_category_votes',
          filter: `room_id=eq.${room.id}`,
        },
        (payload) => {
          if (payload.eventType === 'INSERT') setVoteCount((n) => n + 1)
          // UPDATE means player changed their vote — count stays same
        },
      )
      .subscribe()

    channelRef.current = channel
    return () => { channel.unsubscribe() }
  }, [room?.id])

  async function handleVote(categoryId: string) {
    if (!room || submitting || myVoteId !== null) return
    setSubmitting(true)
    setError(null)

    const { error: rpcErr } = await supabase.rpc('submit_category_vote', {
      p_room_id: room.id,
      p_category_id: categoryId,
    })

    if (rpcErr) {
      setError('Nie udało się oddać głosu.')
    } else {
      setMyVoteId(categoryId)
    }
    setSubmitting(false)
  }

  const activePlayers = players.filter((p) => p.left_at === null)

  if (loading) {
    return (
      <AppLayout>
        <div className="flex flex-1 items-center justify-center">
          <p className="text-sm text-anomaly-lavender/40 animate-pulse">Ładowanie…</p>
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

  return (
    <AppLayout>
      <div className="flex flex-1 flex-col gap-6 py-8">
        {/* Header */}
        <div className="space-y-1">
          <p className="text-xs tracking-widest text-anomaly-gold uppercase">
            Faza 1 · Głosowanie
          </p>
          <h1 className="text-3xl font-bold text-anomaly-primary">Wybierz kategorię</h1>
        </div>

        {/* Timer + progress */}
        <div className="flex items-center justify-between rounded-xl border border-anomaly-primary/20 bg-anomaly-primary/5 px-4 py-3">
          <span className="text-sm text-anomaly-lavender/60">
            Zagłosowało:{' '}
            <span className={cn('font-semibold', voteCount === activePlayers.length ? 'text-anomaly-gold' : 'text-anomaly-lavender')}>
              {voteCount}/{activePlayers.length}
            </span>
          </span>
          <span
            className={cn(
              'font-mono text-lg font-bold tabular-nums',
              secondsLeft <= 5 ? 'text-red-400' : 'text-anomaly-primary',
            )}
          >
            {secondsLeft}s
          </span>
        </div>

        {/* Category grid */}
        {myVoteId ? (
          <div className="flex flex-1 flex-col gap-3">
            <p className="text-xs tracking-widest text-anomaly-gold uppercase">Twój głos</p>
            <div className="grid grid-cols-2 gap-3">
              {categories.map((cat) => (
                <div
                  key={cat.id}
                  className={cn(
                    'rounded-2xl border-2 px-4 py-5 text-center transition-all',
                    cat.id === myVoteId
                      ? 'border-anomaly-primary bg-anomaly-primary/15 text-anomaly-lavender font-semibold'
                      : 'border-anomaly-primary/10 bg-white/[0.02] text-anomaly-lavender/30',
                  )}
                >
                  {cat.name}
                </div>
              ))}
            </div>
            <p className="mt-2 text-center text-sm text-anomaly-lavender/40 animate-pulse">
              Czekaj na pozostałych graczy…
            </p>
          </div>
        ) : (
          <div className="flex flex-1 flex-col gap-3">
            <p className="text-xs tracking-widest text-anomaly-gold uppercase">Kategorie</p>
            <div className="grid grid-cols-2 gap-3">
              {categories.map((cat) => (
                <button
                  key={cat.id}
                  onClick={() => handleVote(cat.id)}
                  disabled={submitting}
                  className={cn(
                    'rounded-2xl border-2 border-anomaly-primary/30 bg-white/5 px-4 py-5',
                    'text-center font-medium text-anomaly-lavender transition-all',
                    'active:scale-95 active:border-anomaly-primary/60',
                    'disabled:cursor-not-allowed disabled:opacity-40',
                  )}
                >
                  {cat.name}
                </button>
              ))}
            </div>
            {error && <p className="text-center text-sm text-red-400">{error}</p>}
          </div>
        )}
      </div>
    </AppLayout>
  )
}
