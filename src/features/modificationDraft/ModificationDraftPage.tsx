import { useEffect, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { AppLayout } from '../../components/layout/AppLayout'
import { ModificationCard } from '../../components/cards/ModificationCard'
import { supabase } from '../../services/supabaseClient'
import { useAuthStore } from '../../store/authStore'
import { cn } from '../../lib/cn'
import type { ModificationConfig, ModificationType, Room, RoomModificationOption } from '../../domain/types'
import type { RealtimeChannel } from '@supabase/supabase-js'

interface DBModification {
  id: string
  name: string
  type: string
  effect_description: string
  duration_description: string
  flavor: string
}

function toModificationConfig(db: DBModification): ModificationConfig {
  return {
    id: db.id,
    name: db.name,
    type: db.type as ModificationType,
    effect: db.effect_description,
    duration: db.duration_description,
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

    const tick = () => setSecondsLeft(Math.max(0, Math.ceil((end - Date.now()) / 1000)))
    tick()
    const id = setInterval(tick, 500)
    return () => clearInterval(id)
  }, [startedAt, durationMs])

  return secondsLeft
}

export function ModificationDraftPage() {
  const { code } = useParams<{ code: string }>()
  const navigate = useNavigate()
  const { session } = useAuthStore()

  const [room, setRoom] = useState<Room | null>(null)
  const [options, setOptions] = useState<ModificationConfig[]>([])
  const [allOptions, setAllOptions] = useState<RoomModificationOption[]>([])
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [playerCount, setPlayerCount] = useState(0)

  const channelRef = useRef<RealtimeChannel | null>(null)

  const secondsLeft = useCountdown(
    room?.current_phase_started_at ?? null,
    room?.current_phase_duration_ms ?? null,
  )

  // Navigate based on room status
  useEffect(() => {
    if (!room) return
    if (room.status === 'question') navigate(`/question/${code}`)
    if (room.status === 'anomaly_reveal') navigate(`/anomaly-reveal/${code}`)
    if (room.status === 'finished') navigate(`/scoreboard/${code}`)
    if (room.status === 'lobby') navigate(`/lobby/${code}`)
    if (room.status === 'results') navigate(`/question/${code}`)
  }, [room?.status, code, navigate])

  // Initial load
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

      const r = roomData as Room
      setRoom(r)

      const draftStage = r.current_question_index

      // Load all modification options for this room/stage (for count)
      const { data: allOptsData } = await supabase
        .from('room_modification_options')
        .select('*')
        .eq('room_id', r.id)
        .eq('draft_stage', draftStage)

      if (allOptsData) {
        setAllOptions(allOptsData as RoomModificationOption[])
      }

      // My options
      const myOpts = (allOptsData as RoomModificationOption[] | null)?.find(
        (o) => o.user_id === session!.user.id,
      )

      if (myOpts) {
        if (myOpts.selected_modification_id) {
          setSelectedId(myOpts.selected_modification_id)
        }

        const { data: modsData } = await supabase
          .from('modifications')
          .select('id,name,type,effect_description,duration_description,flavor')
          .in('id', myOpts.modification_ids)

        if (modsData) {
          const ordered = myOpts.modification_ids
            .map((id) => (modsData as DBModification[]).find((m) => m.id === id))
            .filter(Boolean) as DBModification[]
          setOptions(ordered.map(toModificationConfig))
        }
      }

      // Total player count
      const { count } = await supabase
        .from('room_players')
        .select('*', { count: 'exact', head: true })
        .eq('room_id', r.id)
        .is('left_at', null)

      setPlayerCount(count ?? 0)
      setLoading(false)
    }

    load()
  }, [code, session])

  // Realtime subscriptions
  useEffect(() => {
    if (!room?.id) return

    const channel = supabase
      .channel(`mod-draft:${room.id}`)
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
          table: 'room_modification_options',
          filter: `room_id=eq.${room.id}`,
        },
        (payload) => {
          const updated = payload.new as RoomModificationOption
          setAllOptions((prev) => {
            const idx = prev.findIndex(
              (o) => o.user_id === updated.user_id && o.draft_stage === updated.draft_stage,
            )
            if (idx === -1) return [...prev, updated]
            const next = [...prev]
            next[idx] = updated
            return next
          })
        },
      )
      .subscribe()

    channelRef.current = channel
    return () => { channel.unsubscribe() }
  }, [room?.id])

  // Timeout fallback: force-advance when timer hits 0
  useEffect(() => {
    if (secondsLeft === 0 && room?.id && room.status === 'modification_draft') {
      supabase
        .rpc('prepare_modification_draft', {
          p_room_id: room.id,
          p_draft_stage: room.current_question_index,
        })
        .then(null, () => {})
    }
  }, [secondsLeft, room?.id, room?.status, room?.current_question_index])

  async function handleSelect(modificationId: string) {
    if (!room || submitting || selectedId !== null) return
    setSubmitting(true)
    setError(null)

    const { error: rpcErr } = await supabase.rpc('select_modification', {
      p_room_id: room.id,
      p_draft_stage: room.current_question_index,
      p_modification_id: modificationId,
    })

    if (rpcErr) {
      if (rpcErr.message?.includes('ALREADY_SELECTED')) {
        setSelectedId(modificationId)
      } else {
        setError('Nie udało się wybrać Modyfikacji.')
      }
    } else {
      setSelectedId(modificationId)
    }
    setSubmitting(false)
  }

  const draftStage = room?.current_question_index ?? 0
  const selectedCount = allOptions.filter((o) => o.selected_modification_id !== null).length
  const allSelected = playerCount > 0 && selectedCount >= playerCount

  if (loading) {
    return (
      <AppLayout>
        <div className="flex flex-1 items-center justify-center">
          <p className="text-sm text-anomaly-lavender/40 animate-pulse">Ładowanie modyfikacji…</p>
        </div>
      </AppLayout>
    )
  }

  if (error && !room) {
    return (
      <AppLayout>
        <div className="flex flex-1 flex-col items-center justify-center gap-4">
          <p className="text-sm text-red-400">{error}</p>
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

  return (
    <AppLayout>
      <div className="flex flex-1 flex-col gap-6 py-8">
        {/* Header */}
        <div className="space-y-1">
          <p className="text-xs tracking-widest text-anomaly-gold uppercase">
            Po pytaniu {draftStage} · Draft Modyfikacji
          </p>
          <h1 className="text-3xl font-bold text-anomaly-primary">Wybierz Modyfikację</h1>
          <p className="text-sm text-anomaly-lavender/50">
            Wybrany augment będzie aktywny od następnego pytania.
          </p>
        </div>

        {/* Timer + progress */}
        <div className="flex items-center justify-between rounded-xl border border-anomaly-primary/20 bg-anomaly-primary/5 px-4 py-3">
          <span className="text-sm text-anomaly-lavender/60">
            Wybrało:{' '}
            <span className={cn('font-semibold', allSelected ? 'text-anomaly-gold' : 'text-anomaly-lavender')}>
              {selectedCount}/{playerCount}
            </span>
          </span>
          {!selectedId ? (
            <span
              className={cn(
                'font-mono text-lg font-bold tabular-nums',
                secondsLeft <= 5 ? 'text-red-400' : 'text-anomaly-primary',
              )}
            >
              {secondsLeft}s
            </span>
          ) : (
            <span className="text-xs text-anomaly-lavender/40 animate-pulse">
              Czekaj na pozostałych…
            </span>
          )}
        </div>

        {/* Modification options */}
        <div className="flex flex-col gap-4">
          {options.map((mod) => (
            <ModificationCard
              key={mod.id}
              modification={mod}
              selected={selectedId === mod.id}
              onClick={selectedId === null && !submitting ? () => handleSelect(mod.id) : undefined}
            />
          ))}

          {options.length === 0 && (
            <p className="text-center text-sm text-anomaly-lavender/40">
              Brak opcji modyfikacji — spróbuj odświeżyć stronę.
            </p>
          )}
        </div>

        {error && <p className="text-center text-sm text-red-400">{error}</p>}

        {allSelected && (
          <div className="rounded-xl border border-anomaly-gold/30 bg-anomaly-gold/10 px-4 py-3 text-center text-sm text-anomaly-gold">
            Wszyscy wybrali Modyfikację! Oczekiwanie na następne pytanie…
          </div>
        )}
      </div>
    </AppLayout>
  )
}
