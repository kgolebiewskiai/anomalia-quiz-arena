import { cn } from '../../lib/cn'
import type { ProfileConfig } from '../../domain/types'

interface ProfileCardProps {
  profile: ProfileConfig
  selected?: boolean
  onClick?: () => void
}

const STYLE_LABELS: Record<ProfileConfig['style'], string> = {
  'czas': 'Czas',
  'modyfikacje': 'Modyfikacje',
  'obrona': 'Obrona',
  'informacja': 'Informacja',
  'kopiowanie': 'Kopiowanie',
  'anty-pvp': 'Anty-PvP',
  'seria': 'Seria',
  'reset': 'Reset',
  'szybkość': 'Szybkość',
  'kategorie': 'Kategorie',
  'comeback': 'Comeback',
  'wydłużanie': 'Wydłużanie',
  'końcówka': 'Końcówka',
  'odporność': 'Odporność',
}

export function ProfileCard({ profile, selected = false, onClick }: ProfileCardProps) {
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
          {profile.name}
        </h3>
        <span className="shrink-0 rounded-full bg-anomaly-primary/20 px-2 py-0.5 text-xs font-medium text-anomaly-primary">
          {STYLE_LABELS[profile.style]}
        </span>
      </div>

      <div className="space-y-2 mb-3">
        <div>
          <p className="text-xs font-semibold text-anomaly-gold uppercase tracking-wider mb-1">
            Pasywna
          </p>
          <p className="text-sm text-anomaly-lavender/90 leading-snug">
            {profile.passive}
          </p>
        </div>
        <div>
          <p className="text-xs font-semibold text-anomaly-gold uppercase tracking-wider mb-1">
            Aktywna
          </p>
          <p className="text-sm text-anomaly-lavender/90 leading-snug">
            {profile.active}
          </p>
        </div>
      </div>

      <p className="text-xs text-anomaly-lavender/40 italic leading-snug">
        {profile.flavor}
      </p>
    </button>
  )
}
