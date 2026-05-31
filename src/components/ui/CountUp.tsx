import { useEffect, useRef, useState } from 'react'
import { animate, useReducedMotion } from 'framer-motion'

interface CountUpProps {
  value: number
  /** Animation duration in seconds. */
  duration?: number
  /** Prefix the value with an explicit "+" when positive (for score deltas). */
  showSign?: boolean
  className?: string
}

/**
 * Animates a number from its previous value to the next one instead of snapping.
 * Used for score totals and the scoreboard so points "tick up" smoothly.
 */
export function CountUp({ value, duration = 0.6, showSign = false, className }: CountUpProps) {
  const reduce = useReducedMotion()
  const [display, setDisplay] = useState(value)
  const prevRef = useRef(value)

  useEffect(() => {
    const from = prevRef.current
    prevRef.current = value

    if (reduce || from === value) {
      setDisplay(value)
      return
    }

    const controls = animate(from, value, {
      duration,
      ease: [0.22, 1, 0.36, 1],
      onUpdate: (v) => setDisplay(Math.round(v)),
    })
    return () => controls.stop()
  }, [value, duration, reduce])

  const sign = showSign && display > 0 ? '+' : ''
  return <span className={className}>{sign}{display}</span>
}
