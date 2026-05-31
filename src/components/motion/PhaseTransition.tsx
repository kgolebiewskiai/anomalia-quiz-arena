import type { ReactNode } from 'react'
import { motion, useReducedMotion } from 'framer-motion'

interface PhaseTransitionProps {
  children: ReactNode
  className?: string
}

/**
 * Cross-fade + subtle slide wrapper for a single game phase. Meant to be used as
 * the direct child of an <AnimatePresence mode="wait"> whose key changes per phase,
 * so the old phase fades out before the new one fades in (no hard cut).
 *
 * Honors prefers-reduced-motion: collapses to a plain opacity fade with no movement.
 */
export function PhaseTransition({ children, className }: PhaseTransitionProps) {
  const reduce = useReducedMotion()

  return (
    <motion.div
      className={className}
      initial={{ opacity: 0, y: reduce ? 0 : 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: reduce ? 0 : -12 }}
      transition={{ duration: 0.26, ease: [0.22, 1, 0.36, 1] }}
    >
      {children}
    </motion.div>
  )
}
