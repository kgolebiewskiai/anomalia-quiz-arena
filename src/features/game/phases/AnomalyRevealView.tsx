import { motion, useReducedMotion } from 'framer-motion'
import { AnomalyBanner } from '../../../components/cards/AnomalyBanner'
import { ANOMALIES } from '../../../data/anomalies'
import { useGame } from '../gameContext'

export function AnomalyRevealView() {
  const { room, secondsLeft } = useGame()
  const reduce = useReducedMotion()

  const anomaly = room.active_anomaly_id
    ? (ANOMALIES.find((a) => a.id === room.active_anomaly_id) ?? null)
    : null

  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-8 py-8">
      <div className="text-center space-y-1">
        <p className="text-xs tracking-widest text-anomaly-gold uppercase">Anomalia aktywna</p>
        <p className="text-sm text-anomaly-lavender/50">
          Pytanie {room.current_question_index} · efekt obowiązuje przez całe pytanie
        </p>
      </div>

      {anomaly ? (
        <motion.div
          className="w-full"
          initial={{ opacity: 0, scale: reduce ? 1 : 0.92 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.1, duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
        >
          <AnomalyBanner anomaly={anomaly} questionIndex={room.current_question_index} />
        </motion.div>
      ) : (
        <div className="rounded-2xl border border-anomaly-lavender/20 bg-anomaly-lavender/5 px-5 py-6 text-center text-sm text-anomaly-lavender/50">
          Anomalia…
        </div>
      )}

      <div className="flex flex-col items-center gap-1">
        <span className="font-mono text-5xl font-bold tabular-nums text-anomaly-primary leading-none">
          {secondsLeft}
        </span>
        <span className="text-xs text-anomaly-lavender/40">pytanie startuje za chwilę</span>
      </div>
    </div>
  )
}
