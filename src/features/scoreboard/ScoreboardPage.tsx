import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { motion, useReducedMotion } from 'framer-motion'
import { AppLayout } from '../../components/layout/AppLayout'
import { Stagger, StaggerItem } from '../../components/motion/Stagger'
import { CountUp } from '../../components/ui/CountUp'
import { supabase } from '../../services/supabaseClient'
import { useAuthStore } from '../../store/authStore'
import { cn } from '../../lib/cn'
import type { Room, RoomPlayer, Rating } from '../../domain/types'

const MEDALS = ['🥇', '🥈', '🥉']

export function ScoreboardPage() {
  const { code } = useParams<{ code: string }>()
  const navigate = useNavigate()
  const { session } = useAuthStore()
  const reduce = useReducedMotion()

  const [room, setRoom] = useState<Room | null>(null)
  const [players, setPlayers] = useState<RoomPlayer[]>([])
  const [ratings, setRatings] = useState<Map<string, Rating>>(new Map())
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!code || !session) return

    async function load() {
      const { data: roomData } = await supabase
        .from('rooms')
        .select('*')
        .eq('code', code!.toUpperCase())
        .single()

      if (!roomData) {
        setLoading(false)
        return
      }

      const loadedRoom = roomData as Room
      setRoom(loadedRoom)

      const { data: playersData } = await supabase
        .from('room_players')
        .select('*')
        .eq('room_id', loadedRoom.id)
        .is('left_at', null)
        .order('score', { ascending: false })

      if (playersData) setPlayers(playersData as RoomPlayer[])

      if (loadedRoom.mode === 'ranked') {
        // Trigger rating update (idempotent — first caller does the work)
        await supabase.rpc('update_ratings_after_game', { p_room_id: loadedRoom.id })

        // Fetch current ratings for all players
        const userIds = (playersData ?? []).map((p) => p.user_id)
        if (userIds.length > 0) {
          const { data: ratingsData } = await supabase
            .from('ratings')
            .select('*')
            .in('user_id', userIds)

          if (ratingsData) {
            const map = new Map<string, Rating>()
            for (const r of ratingsData as Rating[]) {
              map.set(r.user_id, r)
            }
            setRatings(map)
          }
        }
      }

      setLoading(false)
    }

    load()
  }, [code, session])

  if (loading) {
    return (
      <AppLayout>
        <div className="flex flex-1 items-center justify-center">
          <p className="text-sm text-anomaly-lavender/40 animate-pulse">Ładowanie wyników…</p>
        </div>
      </AppLayout>
    )
  }

  const winner = players[0]
  const myUserId = session?.user.id
  const isRanked = room?.mode === 'ranked'

  return (
    <AppLayout>
      <div className="flex flex-1 flex-col gap-6 py-8">
        {/* Header */}
        <div className="space-y-1 text-center">
          <p className="text-xs tracking-widest text-anomaly-gold uppercase">
            {isRanked ? 'Ranked · ' : ''}Instytut Anomalii · Koniec Testu
          </p>
          <h1 className="text-3xl font-bold text-anomaly-primary">Wyniki Końcowe</h1>
          {winner && (
            <p className="text-sm text-anomaly-lavender/60 mt-1">
              Zwycięzca:{' '}
              <span className="font-semibold text-anomaly-gold">{winner.display_name}</span>
            </p>
          )}
        </div>

        {/* Podium (top 3) */}
        {players.length >= 2 && (
          <div className="flex items-end justify-center gap-2">
            {[1, 0, 2].map((rankIdx) => {
              const p = players[rankIdx]
              if (!p) return null
              const heights = [96, 128, 72]
              const order = [1, 0, 2].indexOf(rankIdx)
              return (
                <div key={p.user_id} className="flex flex-col items-center gap-1">
                  <span className="text-xs font-semibold text-anomaly-lavender/60 truncate max-w-20 text-center">
                    {p.display_name}
                  </span>
                  <span className="font-mono text-xs text-anomaly-gold">
                    <CountUp value={p.score} /> pkt
                  </span>
                  <motion.div
                    className={cn(
                      'w-20 rounded-t-xl flex items-end justify-center pb-2 overflow-hidden',
                      rankIdx === 0
                        ? 'bg-anomaly-gold/30 border border-anomaly-gold/40'
                        : 'bg-anomaly-primary/20 border border-anomaly-primary/30',
                    )}
                    initial={{ height: reduce ? heights[rankIdx] : 0 }}
                    animate={{ height: heights[rankIdx] }}
                    transition={{ delay: 0.15 + order * 0.12, duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
                  >
                    <span className="text-2xl">{MEDALS[rankIdx] ?? ''}</span>
                  </motion.div>
                </div>
              )
            })}
          </div>
        )}

        {/* Full ranking */}
        <div>
          <p className="text-xs tracking-widest text-anomaly-lavender/40 uppercase mb-3">
            Pełna tabela
          </p>
          <Stagger className="space-y-2">
            {players.map((p, idx) => {
              const ratingEntry = ratings.get(p.user_id)
              return (
                <StaggerItem
                  key={p.user_id}
                  className={cn(
                    'flex items-center justify-between rounded-2xl border px-4 py-4',
                    p.user_id === myUserId
                      ? 'border-anomaly-primary/50 bg-anomaly-primary/10'
                      : 'border-white/10 bg-white/5',
                  )}
                >
                  <div className="flex items-center gap-3">
                    <span className={cn(
                      'w-6 text-center text-sm font-bold',
                      idx === 0 ? 'text-anomaly-gold' : 'text-anomaly-lavender/40',
                    )}>
                      {idx < 3 ? MEDALS[idx] : `${idx + 1}.`}
                    </span>
                    <div>
                      <p className="text-sm font-semibold text-anomaly-lavender">
                        {p.display_name}
                        {p.user_id === myUserId && (
                          <span className="ml-1 text-xs text-anomaly-primary">(ty)</span>
                        )}
                      </p>
                      {p.selected_profile_id && (
                        <p className="text-xs text-anomaly-lavender/40 capitalize">
                          {p.selected_profile_id}
                        </p>
                      )}
                    </div>
                  </div>
                  <div className="text-right">
                    <CountUp
                      value={p.score}
                      className="block font-mono text-lg font-bold text-anomaly-gold"
                    />
                    <p className="text-xs text-anomaly-lavender/40">pkt</p>
                    {isRanked && ratingEntry && (
                      <p className="text-xs text-anomaly-primary/70 mt-0.5">
                        {ratingEntry.rating} <span className="text-anomaly-lavender/30">ELO</span>
                      </p>
                    )}
                  </div>
                </StaggerItem>
              )
            })}
          </Stagger>
        </div>

        {/* Actions */}
        <div className="flex flex-col gap-3 mt-auto pb-4">
          <button
            onClick={() => navigate('/create-room')}
            className="w-full rounded-2xl bg-anomaly-primary py-4 text-sm font-bold text-anomaly-bg transition-opacity active:opacity-80"
          >
            Nowa gra
          </button>
          <button
            onClick={() => navigate('/')}
            className="w-full text-sm text-anomaly-lavender/50 hover:text-anomaly-lavender/80 transition-colors"
          >
            ← Strona główna
          </button>
        </div>
      </div>
    </AppLayout>
  )
}
