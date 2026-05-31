import { useEffect, useRef, useState } from 'react'
import type { RealtimeChannel } from '@supabase/supabase-js'
import { supabase } from '../../../services/supabaseClient'
import { cn } from '../../../lib/cn'
import { Stagger, StaggerItem } from '../../../components/motion/Stagger'
import type { Category } from '../../../domain/types'
import { useGame } from '../gameContext'

export function CategoryVoteView() {
  const { room, players, session } = useGame()

  const [categories, setCategories] = useState<Category[]>([])
  const [myVoteId, setMyVoteId] = useState<string | null>(null)
  const [voteCount, setVoteCount] = useState(0)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const channelRef = useRef<RealtimeChannel | null>(null)
  const { secondsLeft } = useGame()

  // Load categories + existing votes
  useEffect(() => {
    let cancelled = false
    async function load() {
      const [catsRes, votesRes] = await Promise.all([
        supabase.from('categories').select('*').eq('is_enabled', true).order('name'),
        supabase.from('room_category_votes').select('*').eq('room_id', room.id),
      ])
      if (cancelled) return
      if (!catsRes.error && catsRes.data) setCategories(catsRes.data as Category[])
      if (!votesRes.error && votesRes.data) {
        setVoteCount(votesRes.data.length)
        const myVote = votesRes.data.find(
          (v: { user_id: string; category_id: string }) => v.user_id === session.user.id,
        )
        if (myVote) setMyVoteId(myVote.category_id)
      }
    }
    load()
    return () => {
      cancelled = true
    }
  }, [room.id, session.user.id])

  // Vote subscription
  useEffect(() => {
    const channel = supabase
      .channel(`category-votes:${room.id}`)
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
        },
      )
      .subscribe()
    channelRef.current = channel
    return () => {
      channel.unsubscribe()
    }
  }, [room.id])

  async function handleVote(categoryId: string) {
    if (submitting || myVoteId !== null) return
    setSubmitting(true)
    setError(null)
    const { error: rpcErr } = await supabase.rpc('submit_category_vote', {
      p_room_id: room.id,
      p_category_id: categoryId,
    })
    if (rpcErr) setError('Nie udało się oddać głosu.')
    else setMyVoteId(categoryId)
    setSubmitting(false)
  }

  const activePlayers = players.filter((p) => p.left_at === null)

  return (
    <div className="flex flex-1 flex-col gap-6 py-8">
      <div className="space-y-1">
        <p className="text-xs tracking-widest text-anomaly-gold uppercase">Faza 1 · Głosowanie</p>
        <h1 className="text-3xl font-bold text-anomaly-primary">Wybierz kategorię</h1>
      </div>

      <div className="flex items-center justify-between rounded-xl border border-anomaly-primary/20 bg-anomaly-primary/5 px-4 py-3">
        <span className="text-sm text-anomaly-lavender/60">
          Zagłosowało:{' '}
          <span
            className={cn(
              'font-semibold',
              voteCount === activePlayers.length ? 'text-anomaly-gold' : 'text-anomaly-lavender',
            )}
          >
            {voteCount}/{activePlayers.length}
          </span>
        </span>
        <span
          className={cn(
            'font-mono text-lg font-bold tabular-nums transition-colors',
            secondsLeft <= 5 ? 'text-red-400' : 'text-anomaly-primary',
          )}
        >
          {secondsLeft}s
        </span>
      </div>

      <div className="flex flex-1 flex-col gap-3">
        <p className="text-xs tracking-widest text-anomaly-gold uppercase">
          {myVoteId ? 'Twój głos' : 'Kategorie'}
        </p>
        <Stagger className="grid grid-cols-2 gap-3">
          {categories.map((cat) => {
            const locked = myVoteId !== null
            const isMine = cat.id === myVoteId
            return (
              <StaggerItem key={cat.id}>
                <button
                  onClick={() => handleVote(cat.id)}
                  disabled={submitting || locked}
                  className={cn(
                    'w-full rounded-2xl border-2 px-4 py-5 text-center font-medium transition-all',
                    'active:scale-95',
                    locked
                      ? isMine
                        ? 'border-anomaly-primary bg-anomaly-primary/15 text-anomaly-lavender font-semibold'
                        : 'border-anomaly-primary/10 bg-white/[0.02] text-anomaly-lavender/30'
                      : 'border-anomaly-primary/30 bg-white/5 text-anomaly-lavender active:border-anomaly-primary/60 disabled:cursor-not-allowed disabled:opacity-40',
                  )}
                >
                  {cat.name}
                </button>
              </StaggerItem>
            )
          })}
        </Stagger>
        {myVoteId && (
          <p className="mt-2 text-center text-sm text-anomaly-lavender/40 animate-pulse">
            Czekaj na pozostałych graczy…
          </p>
        )}
        {error && <p className="text-center text-sm text-red-400">{error}</p>}
      </div>
    </div>
  )
}
