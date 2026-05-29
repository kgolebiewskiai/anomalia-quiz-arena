import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { AppLayout } from '../../components/layout/AppLayout'
import { supabase } from '../../services/supabaseClient'
import { useAuthStore } from '../../store/authStore'
import { cn } from '../../lib/cn'
import type { RoomPlayer } from '../../domain/types'

const MEDALS = ['🥇', '🥈', '🥉']

export function ScoreboardPage() {
  const { code } = useParams<{ code: string }>()
  const navigate = useNavigate()
  const { session } = useAuthStore()

  const [players, setPlayers] = useState<RoomPlayer[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!code || !session) return

    async function load() {
      const { data: roomData } = await supabase
        .from('rooms')
        .select('*')
        .eq('code', code!.toUpperCase())
        .single()

      if (roomData) {
        const { data: playersData } = await supabase
          .from('room_players')
          .select('*')
          .eq('room_id', roomData.id)
          .is('left_at', null)
          .order('score', { ascending: false })

        if (playersData) setPlayers(playersData as RoomPlayer[])
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

  return (
    <AppLayout>
      <div className="flex flex-1 flex-col gap-6 py-8">
        {/* Header */}
        <div className="space-y-1 text-center">
          <p className="text-xs tracking-widest text-anomaly-gold uppercase">
            Instytut Anomalii · Koniec Testu
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
              return (
                <div key={p.user_id} className="flex flex-col items-center gap-1">
                  <span className="text-xs font-semibold text-anomaly-lavender/60 truncate max-w-20 text-center">
                    {p.display_name}
                  </span>
                  <span className="font-mono text-xs text-anomaly-gold">{p.score} pkt</span>
                  <div
                    className={cn(
                      'w-20 rounded-t-xl flex items-end justify-center pb-2',
                      rankIdx === 0
                        ? 'bg-anomaly-gold/30 border border-anomaly-gold/40'
                        : 'bg-anomaly-primary/20 border border-anomaly-primary/30',
                    )}
                    style={{ height: heights[rankIdx] }}
                  >
                    <span className="text-2xl">{MEDALS[rankIdx] ?? ''}</span>
                  </div>
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
          <div className="space-y-2">
            {players.map((p, idx) => (
              <div
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
                  <p className="font-mono text-lg font-bold text-anomaly-gold">{p.score}</p>
                  <p className="text-xs text-anomaly-lavender/40">pkt</p>
                </div>
              </div>
            ))}
          </div>
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
