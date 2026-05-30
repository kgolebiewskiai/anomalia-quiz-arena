import type { AnomalyConfig } from '../../domain/types'

interface AnomalyBannerProps {
  anomaly: AnomalyConfig
  questionIndex?: number
}

export function AnomalyBanner({ anomaly, questionIndex }: AnomalyBannerProps) {
  return (
    <div className="w-full rounded-2xl border-2 border-anomaly-gold/60 bg-anomaly-gold/10 p-4">
      <div className="flex items-center gap-2 mb-2">
        <span className="text-xs font-semibold text-anomaly-gold uppercase tracking-widest">
          Anomalia
          {questionIndex != null ? ` — Pytanie ${questionIndex}` : ''}
        </span>
      </div>
      <h3 className="text-xl font-bold text-anomaly-gold mb-2 leading-tight">
        {anomaly.name}
      </h3>
      <p className="text-sm text-anomaly-lavender/90 leading-snug">
        {anomaly.effect}
      </p>
    </div>
  )
}
