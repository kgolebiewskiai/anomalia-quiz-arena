import type { ReactNode } from 'react'
import { cn } from '../../lib/cn'

interface AppLayoutProps {
  children: ReactNode
  className?: string
}

export function AppLayout({ children, className }: AppLayoutProps) {
  return (
    <div className="min-h-dvh bg-anomaly-bg">
      <div
        className={cn(
          'mx-auto flex min-h-dvh max-w-lg flex-col px-4',
          'pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)]',
          className,
        )}
      >
        {children}
      </div>
    </div>
  )
}
