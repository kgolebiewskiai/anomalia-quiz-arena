import { useEffect, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { AppLayout } from '../../components/layout/AppLayout'
import { Button } from '../../components/ui/Button'
import { supabase } from '../../services/supabaseClient'
import { useRoomStore } from '../../store/roomStore'
import { useAuthStore } from '../../store/authStore'
import { cn } from '../../lib/cn'
import type { Room, RoomPlayer, Rating } from '../../domain/types'
import type { RealtimeChannel } from '@supabase/supabase-js'

const SLOT_ICONS = ['◈', '◉', '◎', '◇', '◆', '▷', '▶', '◐']

export function LobbyPage() {
  const { code } = useParams<{ code: string }>()
  const navigate = useNavigate()
  const { session } = useAuthStore()
  const { room, players, setRoom, setPlayers, addPlayer, updatePlayer } = useRoomStore()
  const [loading, setLoading] = useState(true)
  const [startLoading, setStartLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  const [ratings, setRatings] = useState<Map<string, number>>(new Map())
  const channelRef = useRef<RealtimeChannel | null>(null)

  const isHost = room?.host_user_id === session?.user.id
  const activePlayers = players.filter((p) => p.left_at === null)
  const canStart = isHost && activePlayers.length >= 1

  // Initial data load
  useEffect(() => {
    if (!code) return

    async function loadRoom() {
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

      const room = roomData as Room

      // Redirect into the game shell if the match already started
      if (room.status !== 'lobby' && room.status !== 'finished') {
        navigate(`/play/${code}`, { replace: true })
        return
      }
      if (room.status === 'finished') {
        navigate(`/scoreboard/${code}`, { replace: true })
        return
      }

      setRoom(room)

      const { data: playersData, error: playersErr } = await supabase
        .from('room_players')
        .select('*')
        .eq('room_id', room.id)
        .is('left_at', null)
        .order('slot')

      if (!playersErr && playersData) {
        setPlayers(playersData as RoomPlayer[])

        if (room.mode === 'ranked' && playersData.length > 0) {
          const userIds = playersData.map((p) => p.user_id)
          const { data: ratingsData } = await supabase
            .from('ratings')
            .select('user_id, rating')
            .in('user_id', userIds)

          if (ratingsData) {
            const map = new Map<string, number>()
            for (const r of ratingsData as Rating[]) {
              map.set(r.user_id, r.rating)
            }
            setRatings(map)
          }
        }
      }

      setLoading(false)
    }

    loadRoom()
  }, [code, setRoom, setPlayers])

  // Realtime subscription
  useEffect(() => {
    if (!room?.id) return

    const channel = supabase
      .channel(`room:${room.code}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'room_players', filter: `room_id=eq.${room.id}` },
        (payload) => {
          if (payload.eventType === 'INSERT') {
            addPlayer(payload.new as RoomPlayer)
          } else if (payload.eventType === 'UPDATE') {
            const updated = payload.new as RoomPlayer
            if (updated.left_at !== null) {
              // Player left — keep in list but mark left
              updatePlayer(updated.user_id, updated)
            } else {
              updatePlayer(updated.user_id, updated)
            }
          }
        },
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'rooms', filter: `id=eq.${room.id}` },
        (payload) => {
          const updated = payload.new as Room
          setRoom(updated)
          if (updated.status !== 'lobby') navigate(`/play/${updated.code}`, { replace: true })
        },
      )
      .subscribe()

    channelRef.current = channel

    return () => {
      channel.unsubscribe()
    }
  }, [room?.id, room?.code, addPlayer, updatePlayer, setRoom])

  async function handleCopyCode() {
    if (!room) return
    await navigator.clipboard.writeText(room.code)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  async function handleCopyLink() {
    const link = `${window.location.origin}/join?code=${room?.code}`
    await navigator.clipboard.writeText(link)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  async function handleStart() {
    if (!room || !canStart) return
    setStartLoading(true)
    setError(null)

    const { error: rpcErr } = await supabase.rpc('start_room', { p_room_id: room.id })
    if (rpcErr) {
      setError('Nie udało się uruchomić Testu. Spróbuj ponownie.')
    }
    setStartLoading(false)
  }

  if (loading) {
    return (
      <AppLayout>
        <div className="flex flex-1 items-center justify-center">
          <p className="text-sm text-anomaly-lavender/40 animate-pulse">Ładowanie Komory…</p>
        </div>
      </AppLayout>
    )
  }

  if (error || !room) {
    return (
      <AppLayout>
        <div className="flex flex-1 flex-col items-center justify-center gap-4">
          <p className="text-sm text-red-400">{error ?? 'Nieznany błąd.'}</p>
          <button
            onClick={() => navigate('/')}
            className="text-xs text-anomaly-lavender/50 hover:text-anomaly-lavender/80 transition-colors"
          >
            ← Wróć do strony głównej
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
            {room.mode === 'ranked' ? 'Ranked' : 'Casual'} · Komora testowa
          </p>
          <h1 className="text-3xl font-bold text-anomaly-primary">Lobby</h1>
        </div>

        {/* Room code */}
        <div className="rounded-2xl border border-anomaly-primary/20 bg-anomaly-primary/5 p-4">
          <p className="mb-2 text-xs tracking-widest text-anomaly-gold uppercase">Kod Komory</p>
          <div className="flex items-center justify-between gap-3">
            <span className="font-mono text-3xl font-bold tracking-[0.25em] text-anomaly-lavender">
              {room.code}
            </span>
            <div className="flex gap-2">
              <button
                onClick={handleCopyCode}
                className={cn(
                  'rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors',
                  copied
                    ? 'border-green-500/40 text-green-400'
                    : 'border-anomaly-primary/30 text-anomaly-lavender/60 hover:border-anomaly-primary/60',
                )}
              >
                {copied ? 'Skopiowano!' : 'Kopiuj kod'}
              </button>
              <button
                onClick={handleCopyLink}
                className="rounded-lg border border-anomaly-primary/30 px-3 py-1.5 text-xs font-medium text-anomaly-lavender/60 hover:border-anomaly-primary/60 transition-colors"
              >
                Kopiuj link
              </button>
            </div>
          </div>
        </div>

        {/* Players list */}
        <div className="flex-1 space-y-2">
          <p className="text-xs tracking-widest text-anomaly-gold uppercase">
            Gracze ({activePlayers.length}/{room.max_players})
          </p>
          <div className="space-y-2">
            {activePlayers
              .sort((a, b) => a.slot - b.slot)
              .map((player) => (
                <div
                  key={player.id}
                  className={cn(
                    'flex items-center gap-3 rounded-xl border px-4 py-3 transition-colors',
                    player.user_id === session?.user.id
                      ? 'border-anomaly-primary/40 bg-anomaly-primary/10'
                      : 'border-anomaly-primary/10 bg-anomaly-primary/5',
                  )}
                >
                  <span className="w-6 text-center text-anomaly-primary/60 text-lg">
                    {SLOT_ICONS[(player.slot - 1) % SLOT_ICONS.length]}
                  </span>
                  <span className="flex-1 font-medium text-anomaly-lavender">
                    {player.display_name}
                  </span>
                  {room.mode === 'ranked' && (
                    <span className="font-mono text-xs text-anomaly-primary/60">
                      {ratings.get(player.user_id) ?? 1000}
                    </span>
                  )}
                  {player.user_id === room.host_user_id && (
                    <span className="rounded-full bg-anomaly-gold/20 px-2 py-0.5 text-xs text-anomaly-gold">
                      host
                    </span>
                  )}
                  {player.user_id === session?.user.id && (
                    <span className="text-xs text-anomaly-lavender/30">ty</span>
                  )}
                </div>
              ))}

            {/* Empty slots */}
            {Array.from({ length: room.max_players - activePlayers.length }).map((_, i) => (
              <div
                key={`empty-${i}`}
                className="flex items-center gap-3 rounded-xl border border-dashed border-anomaly-primary/10 px-4 py-3"
              >
                <span className="w-6 text-center text-anomaly-primary/20 text-lg">
                  {SLOT_ICONS[(activePlayers.length + i) % SLOT_ICONS.length]}
                </span>
                <span className="text-sm text-anomaly-lavender/20">Oczekiwanie na gracza…</span>
              </div>
            ))}
          </div>
        </div>

        {/* Actions */}
        <div className="space-y-3">
          {isHost ? (
            <Button onClick={handleStart} disabled={!canStart || startLoading}>
              {startLoading
                ? 'Uruchamianie…'
                : canStart
                  ? 'Rozpocznij Test'
                  : 'Czekaj na graczy…'}
            </Button>
          ) : (
            <div className="rounded-xl border border-anomaly-primary/10 px-4 py-3 text-center text-sm text-anomaly-lavender/40">
              Oczekiwanie na start od hosta…
            </div>
          )}
          <button
            onClick={() => navigate('/')}
            className="w-full text-center text-xs text-anomaly-lavender/30 hover:text-anomaly-lavender/60 transition-colors py-2"
          >
            Opuść Komorę
          </button>
        </div>
      </div>
    </AppLayout>
  )
}
