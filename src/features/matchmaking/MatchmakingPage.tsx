import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { AppLayout } from '../../components/layout/AppLayout'
import { Button } from '../../components/ui/Button'
import { supabase } from '../../services/supabaseClient'
import { useAuthStore } from '../../store/authStore'
import { cn } from '../../lib/cn'
import type { MatchmakingMode, MatchmakingEntry } from '../../domain/types'
import type { RealtimeChannel } from '@supabase/supabase-js'

const TIMEOUT_SECONDS = 120
const TICK_INTERVAL_MS = 15_000
const INITIAL_RANGE = 100
const RANGE_STEP = 50
const RANGE_INTERVAL_S = 15

export function MatchmakingPage() {
  const navigate = useNavigate()
  const { session } = useAuthStore()
  const [mode, setMode] = useState<MatchmakingMode>('duel')
  const [searching, setSearching] = useState(false)
  const [timedOut, setTimedOut] = useState(false)
  const [myRating, setMyRating] = useState(1000)
  const [elapsed, setElapsed] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const channelRef = useRef<RealtimeChannel | null>(null)
  const tickRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const elapsedRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const modeRef = useRef(mode)

  useEffect(() => {
    modeRef.current = mode
  }, [mode])

  const searchRange = INITIAL_RANGE + Math.floor(elapsed / RANGE_INTERVAL_S) * RANGE_STEP

  // Load rating and check for existing matched entry on mount
  useEffect(() => {
    if (!session) return

    supabase
      .from('ratings')
      .select('rating')
      .eq('user_id', session.user.id)
      .maybeSingle()
      .then(({ data }) => {
        if (data) setMyRating((data as { rating: number }).rating)
      })

    supabase
      .from('matchmaking_queue')
      .select('status, matched_room_code')
      .eq('user_id', session.user.id)
      .maybeSingle()
      .then(({ data }) => {
        const entry = data as Pick<MatchmakingEntry, 'status' | 'matched_room_code'> | null
        if (entry?.status === 'matched' && entry.matched_room_code) {
          navigate(`/lobby/${entry.matched_room_code}`)
        }
      })
  }, [session, navigate])

  function stopTimers() {
    if (tickRef.current) {
      clearInterval(tickRef.current)
      tickRef.current = null
    }
    if (elapsedRef.current) {
      clearInterval(elapsedRef.current)
      elapsedRef.current = null
    }
  }

  function cleanupChannel() {
    if (channelRef.current) {
      channelRef.current.unsubscribe()
      channelRef.current = null
    }
  }

  function finishWithMatch(roomCode: string) {
    stopTimers()
    cleanupChannel()
    navigate(`/lobby/${roomCode}`)
  }

  function finishWithTimeout() {
    stopTimers()
    cleanupChannel()
    setSearching(false)
    setTimedOut(true)
  }

  async function handleSearch() {
    if (!session) return
    setError(null)
    setSearching(true)
    setTimedOut(false)
    setElapsed(0)

    // Subscribe to own queue row — fires when status becomes 'matched' or 'timeout'
    const channel = supabase
      .channel(`matchmaking:${session.user.id}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'matchmaking_queue',
          filter: `user_id=eq.${session.user.id}`,
        },
        (payload) => {
          const row = payload.new as Pick<MatchmakingEntry, 'status' | 'matched_room_code'>
          if (row.status === 'matched' && row.matched_room_code) {
            setSearching(false)
            finishWithMatch(row.matched_room_code)
          } else if (row.status === 'timeout') {
            finishWithTimeout()
          }
        },
      )
      .subscribe()
    channelRef.current = channel

    const { data, error: rpcErr } = await supabase.rpc('join_matchmaking_queue', {
      p_mode: mode,
    })
    if (rpcErr) {
      setError('Błąd połączenia z kolejką. Spróbuj ponownie.')
      setSearching(false)
      stopTimers()
      cleanupChannel()
      return
    }

    const result = data as { status: string; room_code: string | null }
    if (result.status === 'matched' && result.room_code) {
      setSearching(false)
      finishWithMatch(result.room_code)
      return
    }

    // Start elapsed + client-side timeout
    const start = Date.now()
    elapsedRef.current = setInterval(() => {
      const secs = Math.floor((Date.now() - start) / 1000)
      setElapsed(secs)
      if (secs >= TIMEOUT_SECONDS) {
        void supabase.rpc('leave_matchmaking_queue')
        finishWithTimeout()
      }
    }, 1000)

    // Tick every 15 s to expand range and retry matching server-side
    tickRef.current = setInterval(() => {
      void supabase.rpc('tick_matchmaking', { p_mode: modeRef.current })
    }, TICK_INTERVAL_MS)
  }

  async function handleCancel() {
    stopTimers()
    cleanupChannel()
    setSearching(false)
    setElapsed(0)
    await supabase.rpc('leave_matchmaking_queue')
  }

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopTimers()
      cleanupChannel()
    }
  }, [])

  const elapsedDisplay =
    String(Math.floor(elapsed / 60)).padStart(2, '0') +
    ':' +
    String(elapsed % 60).padStart(2, '0')

  return (
    <AppLayout>
      <div className="flex flex-1 flex-col gap-8 py-12">
        {/* Header */}
        <div className="space-y-1">
          <button
            onClick={() => {
              if (searching) handleCancel()
              navigate('/')
            }}
            className="mb-2 text-xs text-anomaly-lavender/50 hover:text-anomaly-lavender/80 transition-colors"
          >
            ← Wróć
          </button>
          <h1 className="text-3xl font-bold text-anomaly-primary">Szukaj gry</h1>
          <p className="text-sm text-anomaly-lavender/60">
            Mecz rankingowy · zmienia rating ELO.
          </p>
        </div>

        {/* Rating badge */}
        <div className="flex items-center gap-3 rounded-xl border border-anomaly-primary/20 bg-anomaly-primary/5 px-4 py-3">
          <span className="text-xs tracking-widest text-anomaly-gold uppercase">Twój rating</span>
          <span className="ml-auto font-mono text-xl font-bold text-anomaly-primary">
            {myRating}
          </span>
        </div>

        {/* ── Idle: mode picker ───────────────────────────────────── */}
        {!searching && !timedOut && (
          <>
            <div className="space-y-2">
              <p className="text-xs tracking-widest text-anomaly-gold uppercase">Tryb gry</p>
              <div className="grid grid-cols-2 gap-3">
                {(['duel', 'arena'] as MatchmakingMode[]).map((m) => (
                  <button
                    key={m}
                    onClick={() => setMode(m)}
                    className={cn(
                      'rounded-xl border-2 px-4 py-4 text-sm font-semibold transition-colors',
                      mode === m
                        ? 'border-anomaly-primary bg-anomaly-primary/10 text-anomaly-primary'
                        : 'border-anomaly-primary/20 text-anomaly-lavender/50 hover:border-anomaly-primary/40',
                    )}
                  >
                    {m === 'duel' ? '1v1 Duel' : '4P Arena'}
                    <span className="mt-1 block text-xs font-normal opacity-60">
                      {m === 'duel' ? '2 graczy' : '4 graczy'}
                    </span>
                  </button>
                ))}
              </div>
            </div>

            {error && (
              <p className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-400">
                {error}
              </p>
            )}

            <div className="mt-auto">
              <Button onClick={handleSearch} disabled={!session}>
                Szukaj gry
              </Button>
            </div>
          </>
        )}

        {/* ── Searching ───────────────────────────────────────────── */}
        {searching && (
          <div className="flex flex-1 flex-col items-center justify-center gap-8">
            {/* Pulse animation */}
            <div className="relative flex h-32 w-32 items-center justify-center">
              <div className="absolute inset-0 animate-ping rounded-full bg-anomaly-primary/10" />
              <div className="absolute inset-4 animate-pulse rounded-full bg-anomaly-primary/15" />
              <div className="z-10 flex h-16 w-16 items-center justify-center rounded-full border-2 border-anomaly-primary bg-anomaly-bg">
                <span className="font-mono text-sm font-bold text-anomaly-primary">
                  {mode === 'duel' ? '1v1' : '4P'}
                </span>
              </div>
            </div>

            <div className="space-y-1 text-center">
              <p className="text-lg font-semibold text-anomaly-lavender">
                Szukam przeciwnika…
              </p>
              <p className="font-mono text-sm text-anomaly-lavender/40">{elapsedDisplay}</p>
            </div>

            {/* Range indicator */}
            <div className="w-full rounded-xl border border-anomaly-primary/10 bg-anomaly-primary/5 px-4 py-3 text-center">
              <p className="mb-1 text-xs text-anomaly-lavender/40">Zakres ratingu</p>
              <p className="font-mono font-bold text-anomaly-primary">
                {myRating - searchRange} – {myRating + searchRange}
              </p>
              <p className="mt-1 text-xs text-anomaly-lavender/30">
                rozszerza się co {RANGE_INTERVAL_S}s (+{RANGE_STEP})
              </p>
            </div>

            <button
              onClick={handleCancel}
              className="text-sm text-anomaly-lavender/40 hover:text-anomaly-lavender/70 transition-colors"
            >
              Anuluj wyszukiwanie
            </button>
          </div>
        )}

        {/* ── Timeout ─────────────────────────────────────────────── */}
        {timedOut && (
          <div className="flex flex-1 flex-col items-center justify-center gap-6 text-center">
            <p className="font-mono text-5xl font-bold text-anomaly-primary/30">2:00</p>
            <div className="space-y-2">
              <p className="text-lg font-semibold text-anomaly-lavender">
                Nie znaleziono meczu
              </p>
              <p className="text-sm text-anomaly-lavender/50">
                Brak graczy o podobnym ratingu w ciągu 2 minut.
              </p>
            </div>
            <div className="w-full max-w-xs space-y-3">
              <Button
                onClick={() => {
                  setTimedOut(false)
                  setElapsed(0)
                }}
              >
                Szukaj ponownie
              </Button>
              <button
                onClick={() => navigate('/')}
                className="w-full py-2 text-center text-xs text-anomaly-lavender/30 hover:text-anomaly-lavender/60 transition-colors"
              >
                Wróć do strony głównej
              </button>
            </div>
          </div>
        )}
      </div>
    </AppLayout>
  )
}
