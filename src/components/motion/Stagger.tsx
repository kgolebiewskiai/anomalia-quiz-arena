import type { ReactNode } from 'react'
import { motion, useReducedMotion, type Variants } from 'framer-motion'

const container: Variants = {
  hidden: {},
  show: {
    transition: { staggerChildren: 0.07, delayChildren: 0.05 },
  },
}

const item: Variants = {
  hidden: { opacity: 0, y: 10 },
  show: { opacity: 1, y: 0, transition: { duration: 0.3, ease: [0.22, 1, 0.36, 1] } },
}

const itemReduced: Variants = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { duration: 0.2 } },
}

interface StaggerProps {
  children: ReactNode
  className?: string
}

/**
 * Reveals its children one after another, top-to-bottom. Each direct child must
 * be a <StaggerItem>. Used for the score breakdown, answer options, card lists
 * and scoreboard rows so content arrives in sequence instead of all at once.
 */
export function Stagger({ children, className }: StaggerProps) {
  return (
    <motion.div className={className} variants={container} initial="hidden" animate="show">
      {children}
    </motion.div>
  )
}

export function StaggerItem({ children, className }: StaggerProps) {
  const reduce = useReducedMotion()
  return (
    <motion.div className={className} variants={reduce ? itemReduced : item}>
      {children}
    </motion.div>
  )
}
