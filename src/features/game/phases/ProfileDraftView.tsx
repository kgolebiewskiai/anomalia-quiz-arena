import { useEffect, useState } from 'react'
import { ProfileCard } from '../../../components/cards/ProfileCard'
import { supabase } from '../../../services/supabaseClient'
import { cn } from '../../../lib/cn'
import { Stagger, StaggerItem } from '../../../components/motion/Stagger'
import type { ProfileConfig, ProfileStyle } from '../../../domain/types'
import { useGame } from '../gameContext'

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

export function ProfileDraftView() {
  const { room, players, session, secondsLeft } = useGame()

  const [options, setOptions] = useState<ProfileConfig[]>([])
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const me = players.find((p) => p.user_id === session.user.id)
  const selectedId = me?.selected_profile_id ?? null

  useEffect(() => {
    let cancelled = false
    async function load() {
      const { data: optsData, error: optsErr } = await supabase
        .from('room_profile_options')
        .select('profile_ids')
        .eq('room_id', room.id)
        .eq('user_id', session.user.id)
        .single()

      if (cancelled || optsErr || !optsData) return
      const profileIds = (optsData as { profile_ids: string[] }).profile_ids

      const { data: profilesData } = await supabase
        .from('profiles')
        .select('id,name,style,passive_description,active_description,flavor')
        .in('id', profileIds)

      if (cancelled || !profilesData) return
      const ordered = profileIds
        .map((id) => (profilesData as DBProfile[]).find((p) => p.id === id))
        .filter(Boolean) as DBProfile[]
      setOptions(ordered.map(toProfileConfig))
    }
    load()
    return () => {
      cancelled = true
    }
  }, [room.id, session.user.id])

  async function handleSelect(profileId: string) {
    if (submitting || selectedId !== null) return
    setSubmitting(true)
    setError(null)
    const { error: rpcErr } = await supabase.rpc('select_profile', {
      p_room_id: room.id,
      p_profile_id: profileId,
    })
    if (rpcErr) setError('Nie udało się wybrać Profilu.')
    setSubmitting(false)
  }

  const activePlayers = players.filter((p) => p.left_at === null)
  const selectedCount = activePlayers.filter((p) => p.selected_profile_id !== null).length
  const allSelected = selectedCount === activePlayers.length && activePlayers.length > 0

  return (
    <div className="flex flex-1 flex-col gap-6 py-8">
      <div className="space-y-1">
        <p className="text-xs tracking-widest text-anomaly-gold uppercase">Faza 2 · Draft Profilu</p>
        <h1 className="text-3xl font-bold text-anomaly-primary">Wybierz Profil</h1>
      </div>

      <div className="flex items-center justify-between rounded-xl border border-anomaly-primary/20 bg-anomaly-primary/5 px-4 py-3">
        <span className="text-sm text-anomaly-lavender/60">
          Wybrało:{' '}
          <span
            className={cn('font-semibold', allSelected ? 'text-anomaly-gold' : 'text-anomaly-lavender')}
          >
            {selectedCount}/{activePlayers.length}
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
        {options.map((profile) => (
          <StaggerItem key={profile.id}>
            <ProfileCard
              profile={profile}
              selected={selectedId === profile.id}
              onClick={selectedId === null && !submitting ? () => handleSelect(profile.id) : undefined}
            />
          </StaggerItem>
        ))}
        {options.length === 0 && (
          <p className="text-center text-sm text-anomaly-lavender/40">Wczytywanie profili…</p>
        )}
      </Stagger>

      {error && <p className="text-center text-sm text-red-400">{error}</p>}

      {allSelected && (
        <div className="rounded-xl border border-anomaly-gold/30 bg-anomaly-gold/10 px-4 py-3 text-center text-sm text-anomaly-gold">
          Wszyscy wybrali Profil! Oczekiwanie na start Testu…
        </div>
      )}
    </div>
  )
}
