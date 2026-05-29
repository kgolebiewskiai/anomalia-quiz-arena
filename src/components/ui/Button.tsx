import type { ButtonHTMLAttributes } from 'react'
import { cn } from '../../lib/cn'

type Variant = 'primary' | 'ghost'

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant
}

export function Button({ variant = 'primary', className, children, ...props }: ButtonProps) {
  return (
    <button
      className={cn(
        'w-full rounded-xl px-6 py-4 text-base font-semibold transition-opacity',
        'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-anomaly-primary',
        'disabled:cursor-not-allowed disabled:opacity-40',
        variant === 'primary' && [
          'bg-anomaly-primary text-anomaly-bg',
          'active:opacity-80',
        ],
        variant === 'ghost' && [
          'border border-anomaly-primary text-anomaly-primary',
          'active:opacity-80',
        ],
        className,
      )}
      {...props}
    >
      {children}
    </button>
  )
}
