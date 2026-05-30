import { useState } from 'react'
import { Button } from '../../components/ui/Button'
import { cn } from '../../lib/cn'
import { setDisplayName } from '../../services/authService'
import { useAuthStore } from '../../store/authStore'

interface Props {
  userId: string
  onDone: () => void
}

export function SetDisplayNameModal({ userId, onDone }: Props) {
  const setProfile = useAuthStore((s) => s.setProfile)
  const [nick, setNick] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setSaving(true)
    try {
      const profile = await setDisplayName(userId, nick)
      setProfile(profile)
      onDone()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Błąd zapisu.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4">
      <div className="w-full max-w-sm rounded-2xl border border-anomaly-primary/30 bg-anomaly-bg p-6">
        <h2 className="mb-1 text-xl font-bold text-anomaly-lavender">
          Ustaw swój nick
        </h2>
        <p className="mb-5 text-sm text-anomaly-lavender/60">
          Widoczny dla innych graczy w pokoju.
        </p>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <input
            type="text"
            value={nick}
            onChange={(e) => setNick(e.target.value)}
            placeholder="np. Kwant47"
            maxLength={24}
            autoFocus
            className={cn(
              'w-full rounded-xl border bg-white/5 px-4 py-3 text-anomaly-lavender',
              'placeholder:text-anomaly-lavender/30',
              'focus:outline-none focus:ring-2 focus:ring-anomaly-primary',
              'border-anomaly-primary/30',
            )}
          />
          {error && (
            <p className="text-sm text-red-400">{error}</p>
          )}
          <Button
            type="submit"
            disabled={saving || nick.trim().length < 2}
          >
            {saving ? 'Zapisywanie…' : 'Zatwierdź'}
          </Button>
        </form>
      </div>
    </div>
  )
}
