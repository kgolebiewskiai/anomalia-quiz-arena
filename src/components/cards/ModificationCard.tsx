import { cn } from '../../lib/cn'
import type { ModificationConfig } from '../../domain/types'

interface ModificationCardProps {
  modification: ModificationConfig
  selected?: boolean
  onClick?: () => void
}

export function ModificationCard({ modification, selected = false, onClick }: ModificationCardProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'w-full text-left rounded-2xl p-4 transition-all',
        'border-2',
        selected
          ? 'border-anomaly-primary bg-anomaly-primary/10'
          : 'border-anomaly-primary/30 bg-white/5 active:border-anomaly-primary/60',
        onClick ? 'cursor-pointer' : 'cursor-default',
      )}
    >
      <div className="flex items-start justify-between gap-2 mb-3">
        <h3 className="text-lg font-bold text-anomaly-lavender leading-tight">
          {modification.name}
        </h3>
        <span className="shrink-0 rounded-full bg-anomaly-gold/20 px-2 py-0.5 text-xs font-medium text-anomaly-gold">
          {modification.type}
        </span>
      </div>

      <div className="space-y-2 mb-3">
        <div>
          <p className="text-xs font-semibold text-anomaly-gold uppercase tracking-wider mb-1">
            Efekt
          </p>
          <p className="text-sm text-anomaly-lavender/90 leading-snug">
            {modification.effect}
          </p>
        </div>
        <div>
          <p className="text-xs font-semibold text-anomaly-gold uppercase tracking-wider mb-1">
            Czas działania
          </p>
          <p className="text-sm text-anomaly-primary font-medium">
            {modification.duration}
          </p>
        </div>
      </div>

      <p className="text-xs text-anomaly-lavender/40 italic leading-snug">
        {modification.flavor}
      </p>
    </button>
  )
}
