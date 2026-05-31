import { useEffect, useRef, useState } from 'react'
import type { RealtimeChannel } from '@supabase/supabase-js'
import { ModificationCard } from '../../../components/cards/ModificationCard'
import { supabase } from '../../../services/supabaseClient'
import { cn } from '../../../lib/cn'
import { Stagger, StaggerItem } from '../../../components/motion/Stagger'
import type {
  ModificationConfig,
  ModificationType,
  RoomModificationOption,
} from '../../../domain/types'
import { useGame } from '../gameContext'

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

export function ModificationDraftView() {
  const { room, players, session, secondsLeft } = useGame()

  const [options, setOptions] = useState<ModificationConfig[]>([])
  const [allOptions, setAllOptions] = useState<RoomModificationOption[]>([])
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const channelRef = useRef<RealtimeChannel | null>(null)
  const draftStage = room.current_question_index

  useEffect(() => {
    let cancelled = false
    async function load() {
      const { data: allOptsData } = await supabase
        .from('room_modification_options')
        .select('*')
        .eq('room_id', room.id)
        .eq('draft_stage', draftStage)

      if (cancelled) return
      const all = (allOptsData as RoomModificationOption[] | null) ?? []
      setAllOptions(all)

      const myOpts = all.find((o) => o.user_id === session.user.id)
      if (myOpts) {
        if (myOpts.selected_modification_id) setSelectedId(myOpts.selected_modification_id)
        const { data: modsData } = await supabase
          .from('modifications')
          .select('id,name,type,effect_description,duration_description,flavor')
          .in('id', myOpts.modification_ids)
        if (!cancelled && modsData) {
          const ordered = myOpts.modification_ids
            .map((id) => (modsData as DBModification[]).find((m) => m.id === id))
            .filter(Boolean) as DBModification[]
          setOptions(ordered.map(toModificationConfig))
        }
      }
    }
    load()
    return () => {
      cancelled = true
    }
  }, [room.id, draftStage, session.user.id])

  useEffect(() => {
    const channel = supabase
      .channel(`mod-options:${room.id}`)
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
    return () => {
      channel.unsubscribe()
    }
  }, [room.id])

  async function handleSelect(modificationId: string) {
    if (submitting || selectedId !== null) return
    setSubmitting(true)
    setError(null)
    const { error: rpcErr } = await supabase.rpc('select_modification', {
      p_room_id: room.id,
      p_draft_stage: draftStage,
      p_modification_id: modificationId,
    })
    if (rpcErr) {
      if (rpcErr.message?.includes('ALREADY_SELECTED')) setSelectedId(modificationId)
      else setError('Nie udało się wybrać Modyfikacji.')
    } else {
      setSelectedId(modificationId)
    }
    setSubmitting(false)
  }

  const activeCount = players.filter((p) => p.left_at === null).length
  const selectedCount = allOptions.filter((o) => o.selected_modification_id !== null).length
  const allSelected = activeCount > 0 && selectedCount >= activeCount

  return (
    <div className="flex flex-1 flex-col gap-6 py-8">
      <div className="space-y-1">
        <p className="text-xs tracking-widest text-anomaly-gold uppercase">
          Po pytaniu {draftStage} · Draft Modyfikacji
        </p>
        <h1 className="text-3xl font-bold text-anomaly-primary">Wybierz Modyfikację</h1>
        <p className="text-sm text-anomaly-lavender/50">
          Wybrany augment będzie aktywny od następnego pytania.
        </p>
      </div>

      <div className="flex items-center justify-between rounded-xl border border-anomaly-primary/20 bg-anomaly-primary/5 px-4 py-3">
        <span className="text-sm text-anomaly-lavender/60">
          Wybrało:{' '}
          <span
            className={cn('font-semibold', allSelected ? 'text-anomaly-gold' : 'text-anomaly-lavender')}
          >
            {selectedCount}/{activeCount}
          </span>
        </span>
        {!selectedId ? (
          <span
            className={cn(
              'font-mono text-lg font-bold tabular-nums transition-colors',
              secondsLeft <= 5 ? 'text-red-400' : 'text-anomaly-primary',
            )}
          >
            {secondsLeft}s
          </span>
        ) : (
          <span className="text-xs text-anomaly-lavender/40 animate-pulse">Czekaj na pozostałych…</span>
        )}
      </div>

      <Stagger className="flex flex-col gap-4">
        {options.map((mod) => (
          <StaggerItem key={mod.id}>
            <ModificationCard
              modification={mod}
              selected={selectedId === mod.id}
              onClick={selectedId === null && !submitting ? () => handleSelect(mod.id) : undefined}
            />
          </StaggerItem>
        ))}
        {options.length === 0 && (
          <p className="text-center text-sm text-anomaly-lavender/40">Wczytywanie modyfikacji…</p>
        )}
      </Stagger>

      {error && <p className="text-center text-sm text-red-400">{error}</p>}

      {allSelected && (
        <div className="rounded-xl border border-anomaly-gold/30 bg-anomaly-gold/10 px-4 py-3 text-center text-sm text-anomaly-gold">
          Wszyscy wybrali Modyfikację! Oczekiwanie na następne pytanie…
        </div>
      )}
    </div>
  )
}
