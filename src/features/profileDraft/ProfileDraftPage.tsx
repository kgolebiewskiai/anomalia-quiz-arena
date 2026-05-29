import { useEffect, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { AppLayout } from '../../components/layout/AppLayout'
import { ProfileCard } from '../../components/cards/ProfileCard'
import { supabase } from '../../services/supabaseClient'
import { useAuthStore } from '../../store/authStore'
import { cn } from '../../lib/cn'
import type { ProfileConfig, ProfileStyle, Room, RoomPlayer } from '../../domain/types'
import type { RealtimeChannel } from '@supabase/supabase-js'

interface DBProfile {
  id: string
  name: string
  style: ProfileStyle
  passive_description: string
  active_description: string
  flavor: string
}

function toProfileConfig(db: DBProfile): ProfileConfig {
  return {
    id: db.id,
    name: db.name,
    style: db.style,
    passive: db.passive_description,
    active: db.active_description,
    flavor: db.flavor,
  }
}

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

export function ProfileDraftPage() {
  const { code } = useParams<{ code: string }>()
  const navigate = useNavigate()
  const { session } = useAuthStore()

  const [room, setRoom] = useState<Room | null>(null)
  const [players, setPlayers] = useState<RoomPlayer[]>([])
  const [options, setOptions] = useState<ProfileConfig[]>([])
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const channelRef = useRef<RealtimeChannel | null>(null)

  const secondsLeft = useCountdown(
    room?.current_phase_started_at ?? null,
    room?.current_phase_duration_ms ?? null,
  )

  // Navigate based on room status
  useEffect(() => {
    if (!room) return
    if (room.status === 'lobby') navigate(`/lobby/${code}`)
    if (room.status === 'category_vote') navigate(`/category-vote/${code}`)
    if (room.status === 'question') navigate(`/question/${code}`)
    if (room.status === 'finished') navigate(`/scoreboard/${code}`)
  }, [room?.status, code, navigate])

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

      const [playersRes, optsRes] = await Promise.all([
        supabase
          .from('room_players')
          .select('*')
          .eq('room_id', roomData.id)
          .is('left_at', null)
          .order('slot'),
        supabase
          .from('room_profile_options')
          .select('profile_ids')
          .eq('room_id', roomData.id)
          .eq('user_id', session!.user.id)
          .single(),
      ])

      if (!playersRes.error && playersRes.data) {
        const pl = playersRes.data as RoomPlayer[]
        setPlayers(pl)
        const me = pl.find((p) => p.user_id === session!.user.id)
        if (me?.selected_profile_id) setSelectedId(me.selected_profile_id)
      }

      if (!optsRes.error && optsRes.data) {
        const profileIds = (optsRes.data as { profile_ids: string[] }).profile_ids

        const { data: profilesData } = await supabase
          .from('profiles')
          .select('id,name,style,passive_description,active_description,flavor')
          .in('id', profileIds)

        if (profilesData) {
          const ordered = profileIds.map((id) =>
            (profilesData as DBProfile[]).find((p) => p.id === id),
          ).filter(Boolean) as DBProfile[]

          setOptions(ordered.map(toProfileConfig))
        }
      }

      setLoading(false)
    }

    load()
  }, [code, session])

  // Realtime subscriptions
  useEffect(() => {
    if (!room?.id) return

    const channel = supabase
      .channel(`profile-draft:${room.id}`)
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'rooms', filter: `id=eq.${room.id}` },
        (payload) => setRoom(payload.new as Room),
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'room_players',
          filter: `room_id=eq.${room.id}`,
        },
        (payload) => {
          const updated = payload.new as RoomPlayer
          setPlayers((prev) =>
            prev.map((p) => (p.user_id === updated.user_id ? updated : p)),
          )
        },
      )
      .subscribe()

    channelRef.current = channel
    return () => { channel.unsubscribe() }
  }, [room?.id])

  async function handleSelect(profileId: string) {
    if (!room || submitting || selectedId !== null) return
    setSubmitting(true)
    setError(null)

    const { error: rpcErr } = await supabase.rpc('select_profile', {
      p_room_id: room.id,
      p_profile_id: profileId,
    })

    if (rpcErr) {
      setError('Nie udało się wybrać Profilu.')
    } else {
      setSelectedId(profileId)
    }
    setSubmitting(false)
  }

  // Timeout fallback: force-advance to questions when timer hits 0
  useEffect(() => {
    if (secondsLeft === 0 && room?.id && room.status === 'profile_draft') {
      supabase.rpc('prepare_questions', { p_room_id: room.id }).then(null, () => {})
    }
  }, [secondsLeft, room?.id, room?.status])

  const activePlayers = players.filter((p) => p.left_at === null)
  const selectedCount = activePlayers.filter((p) => p.selected_profile_id !== null).length
  const allSelected = selectedCount === activePlayers.length && activePlayers.length > 0

  if (loading) {
    return (
      <AppLayout>
        <div className="flex flex-1 items-center justify-center">
          <p className="text-sm text-anomaly-lavender/40 animate-pulse">Ładowanie profili…</p>
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
            Faza 2 · Draft Profilu
          </p>
          <h1 className="text-3xl font-bold text-anomaly-primary">Wybierz Profil</h1>
        </div>

        {/* Timer + progress */}
        <div className="flex items-center justify-between rounded-xl border border-anomaly-primary/20 bg-anomaly-primary/5 px-4 py-3">
          <span className="text-sm text-anomaly-lavender/60">
            Wybrało:{' '}
            <span className={cn('font-semibold', allSelected ? 'text-anomaly-gold' : 'text-anomaly-lavender')}>
              {selectedCount}/{activePlayers.length}
            </span>
          </span>
          {!selectedId && (
            <span
              className={cn(
                'font-mono text-lg font-bold tabular-nums',
                secondsLeft <= 5 ? 'text-red-400' : 'text-anomaly-primary',
              )}
            >
              {secondsLeft}s
            </span>
          )}
          {selectedId && (
            <span className="text-xs text-anomaly-lavender/40 animate-pulse">
              Czekaj na pozostałych…
            </span>
          )}
        </div>

        {/* Profile options */}
        <div className="flex flex-col gap-4">
          {options.map((profile) => (
            <ProfileCard
              key={profile.id}
              profile={profile}
              selected={selectedId === profile.id}
              onClick={selectedId === null && !submitting ? () => handleSelect(profile.id) : undefined}
            />
          ))}

          {options.length === 0 && (
            <p className="text-center text-sm text-anomaly-lavender/40">
              Brak opcji profilu — spróbuj odświeżyć stronę.
            </p>
          )}
        </div>

        {error && <p className="text-center text-sm text-red-400">{error}</p>}

        {allSelected && (
          <div className="rounded-xl border border-anomaly-gold/30 bg-anomaly-gold/10 px-4 py-3 text-center text-sm text-anomaly-gold">
            Wszyscy wybrali Profil! Oczekiwanie na start Testu…
          </div>
        )}
      </div>
    </AppLayout>
  )
}
