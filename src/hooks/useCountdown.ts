import { useEffect, useState } from 'react'

export interface Countdown {
  /** Milliseconds remaining (clamped to >= 0). */
  msLeft: number
  /** Seconds remaining, rounded up. */
  secondsLeft: number
}

/**
 * Single source of truth for phase countdowns. Replaces the four near-identical
 * copies that previously lived in the per-phase pages.
 *
 * Ticks at 100ms so the progress bar / fractional values stay smooth; consumers
 * that only show whole seconds can read `secondsLeft`.
 */
export function useCountdown(startedAt: string | null, durationMs: number | null): Countdown {
  const compute = () => {
    if (!startedAt || !durationMs) return 0
    return Math.max(0, new Date(startedAt).getTime() + durationMs - Date.now())
  }

  const [msLeft, setMsLeft] = useState(compute)

  useEffect(() => {
    if (!startedAt || !durationMs) return
    const end = new Date(startedAt).getTime() + durationMs
    const tick = () => setMsLeft(Math.max(0, end - Date.now()))
    tick()
    const id = setInterval(tick, 100)
    return () => clearInterval(id)
  }, [startedAt, durationMs])

  return { msLeft, secondsLeft: Math.ceil(msLeft / 1000) }
}
