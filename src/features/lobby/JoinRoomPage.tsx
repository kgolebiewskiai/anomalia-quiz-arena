import { useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { AppLayout } from '../../components/layout/AppLayout'
import { Button } from '../../components/ui/Button'
import { supabase } from '../../services/supabaseClient'
import { cn } from '../../lib/cn'

const CODE_LENGTH = 6

function parseError(msg: string): string {
  if (msg.includes('ROOM_NOT_FOUND')) return 'Nie znaleziono pokoju o tym kodzie.'
  if (msg.includes('ROOM_NOT_IN_LOBBY')) return 'Ten pokój już nie przyjmuje graczy.'
  if (msg.includes('ROOM_FULL')) return 'Pokój jest pełny.'
  return 'Nie udało się dołączyć. Sprawdź kod i spróbuj ponownie.'
}

export function JoinRoomPage() {
  const navigate = useNavigate()
  const [digits, setDigits] = useState<string[]>(Array(CODE_LENGTH).fill(''))
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const inputsRef = useRef<(HTMLInputElement | null)[]>([])

  const code = digits.join('')
  const isComplete = code.length === CODE_LENGTH && digits.every((d) => d !== '')

  function handleChange(index: number, value: string) {
    const char = value.replace(/[^a-zA-Z0-9]/g, '').toUpperCase().slice(-1)
    const next = [...digits]
    next[index] = char
    setDigits(next)
    if (char && index < CODE_LENGTH - 1) {
      inputsRef.current[index + 1]?.focus()
    }
  }

  function handleKeyDown(index: number, e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Backspace') {
      if (digits[index]) {
        const next = [...digits]
        next[index] = ''
        setDigits(next)
      } else if (index > 0) {
        inputsRef.current[index - 1]?.focus()
      }
    }
  }

  function handlePaste(e: React.ClipboardEvent) {
    e.preventDefault()
    const pasted = e.clipboardData.getData('text').replace(/[^a-zA-Z0-9]/g, '').toUpperCase().slice(0, CODE_LENGTH)
    const next = Array(CODE_LENGTH).fill('')
    for (let i = 0; i < pasted.length; i++) next[i] = pasted[i]
    setDigits(next)
    const focusIndex = Math.min(pasted.length, CODE_LENGTH - 1)
    inputsRef.current[focusIndex]?.focus()
  }

  async function handleJoin() {
    if (!isComplete) return
    setError(null)
    setLoading(true)
    try {
      const { data, error: rpcError } = await supabase.rpc('join_room', {
        p_code: code,
      })
      if (rpcError) throw rpcError
      const result = data as { room_id: string; code: string; slot: number }
      navigate(`/lobby/${result.code}`)
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e)
      setError(parseError(msg))
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
          <h1 className="text-3xl font-bold text-anomaly-primary">Dołącz kodem</h1>
          <p className="text-sm text-anomaly-lavender/60">
            Wpisz 6-znakowy kod Komory testowej.
          </p>
        </div>

        <div className="flex justify-center gap-2" onPaste={handlePaste}>
          {digits.map((d, i) => (
            <input
              key={i}
              ref={(el) => { inputsRef.current[i] = el }}
              type="text"
              inputMode="text"
              maxLength={1}
              value={d}
              onChange={(e) => handleChange(i, e.target.value)}
              onKeyDown={(e) => handleKeyDown(i, e)}
              className={cn(
                'h-14 w-11 rounded-xl border-2 bg-transparent text-center text-xl font-bold uppercase tracking-widest transition-colors',
                'text-anomaly-lavender outline-none',
                'focus:border-anomaly-primary focus:bg-anomaly-primary/5',
                d ? 'border-anomaly-primary/60' : 'border-anomaly-primary/20',
              )}
            />
          ))}
        </div>

        {error && (
          <p className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-400">
            {error}
          </p>
        )}

        <div className="mt-auto">
          <Button onClick={handleJoin} disabled={!isComplete || loading}>
            {loading ? 'Dołączanie…' : 'Dołącz do Komory'}
          </Button>
        </div>
      </div>
    </AppLayout>
  )
}
