import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { AppLayout } from '../../components/layout/AppLayout'
import { Button } from '../../components/ui/Button'
import { supabase } from '../../services/supabaseClient'
import { cn } from '../../lib/cn'
import type { RoomMode } from '../../domain/types'

export function CreateRoomPage() {
  const navigate = useNavigate()
  const [mode, setMode] = useState<RoomMode>('casual')
  const [maxPlayers, setMaxPlayers] = useState(8)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleCreate() {
    setError(null)
    setLoading(true)
    try {
      const { data, error: rpcError } = await supabase.rpc('create_room', {
        p_mode: mode,
        p_max_players: maxPlayers,
      })
      if (rpcError) throw rpcError
      const result = data as { room_id: string; code: string }
      navigate(`/lobby/${result.code}`)
    } catch (e) {
      setError('Nie udało się stworzyć pokoju. Spróbuj ponownie.')
      console.error(e)
    } finally {
      setLoading(false)
    }
  }

  return (
    <AppLayout>
      <div className="flex flex-1 flex-col gap-8 py-12">
        <div className="space-y-1">
          <button
            onClick={() => navigate('/')}
            className="text-xs text-anomaly-lavender/50 hover:text-anomaly-lavender/80 transition-colors mb-2"
          >
            ← Wróć
          </button>
          <h1 className="text-3xl font-bold text-anomaly-primary">Stwórz Komorę</h1>
          <p className="text-sm text-anomaly-lavender/60">
            Wybierz tryb i zaproś graczy kodem pokoju.
          </p>
        </div>

        <div className="space-y-6">
          {/* Mode toggle */}
          <div className="space-y-2">
            <p className="text-xs tracking-widest text-anomaly-gold uppercase">Tryb</p>
            <div className="grid grid-cols-2 gap-3">
              {(['casual', 'ranked'] as RoomMode[]).map((m) => (
                <button
                  key={m}
                  onClick={() => setMode(m)}
                  className={cn(
                    'rounded-xl border-2 px-4 py-3 text-sm font-semibold transition-colors',
                    mode === m
                      ? 'border-anomaly-primary bg-anomaly-primary/10 text-anomaly-primary'
                      : 'border-anomaly-primary/20 text-anomaly-lavender/50 hover:border-anomaly-primary/40',
                  )}
                >
                  {m === 'casual' ? 'Casual' : 'Ranked'}
                  {m === 'ranked' && (
                    <span className="block text-xs font-normal opacity-60 mt-0.5">
                      zmienia rating
                    </span>
                  )}
                </button>
              ))}
            </div>
          </div>

          {/* Max players */}
          <div className="space-y-2">
            <p className="text-xs tracking-widest text-anomaly-gold uppercase">
              Maks. graczy:{' '}
              <span className="text-anomaly-lavender normal-case font-bold">{maxPlayers}</span>
            </p>
            <input
              type="range"
              min={2}
              max={8}
              value={maxPlayers}
              onChange={(e) => setMaxPlayers(Number(e.target.value))}
              className="w-full accent-anomaly-primary"
            />
            <div className="flex justify-between text-xs text-anomaly-lavender/30">
              <span>2</span>
              <span>8</span>
            </div>
          </div>
        </div>

        {error && (
          <p className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-400">
            {error}
          </p>
        )}

        <div className="mt-auto">
          <Button onClick={handleCreate} disabled={loading}>
            {loading ? 'Tworzenie…' : 'Stwórz Komorę testową'}
          </Button>
        </div>
      </div>
    </AppLayout>
  )
}
