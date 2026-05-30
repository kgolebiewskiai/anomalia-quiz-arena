import { AppLayout } from '../../components/layout/AppLayout'
import { ProfileCard } from '../../components/cards/ProfileCard'
import { ModificationCard } from '../../components/cards/ModificationCard'
import { AnomalyBanner } from '../../components/cards/AnomalyBanner'
import { PROFILES } from '../../data/profiles'
import { MODIFICATIONS } from '../../data/modifications'
import { ANOMALIES } from '../../data/anomalies'

function Section({ title, count, children }: { title: string; count: number; children: React.ReactNode }) {
  return (
    <section className="mb-12">
      <div className="flex items-baseline gap-3 mb-4">
        <h2 className="text-xl font-bold text-anomaly-primary">{title}</h2>
        <span className="text-sm text-anomaly-lavender/40">{count} pozycji</span>
      </div>
      {children}
    </section>
  )
}

export function DevCardsPage() {
  return (
    <AppLayout>
      <div className="px-4 py-8 max-w-lg mx-auto">
        <div className="mb-8">
          <p className="text-xs tracking-widest text-anomaly-gold uppercase mb-1">Dev Preview</p>
          <h1 className="text-2xl font-bold text-anomaly-lavender">Karty — Faza 2</h1>
        </div>

        <Section title="Anomalie" count={ANOMALIES.length}>
          <div className="space-y-3">
            {ANOMALIES.map((anomaly, i) => (
              <AnomalyBanner key={anomaly.id} anomaly={anomaly} questionIndex={i === 0 ? 4 : 8} />
            ))}
          </div>
        </Section>

        <Section title="Profile" count={PROFILES.length}>
          <div className="space-y-3">
            {PROFILES.map((profile) => (
              <ProfileCard key={profile.id} profile={profile} />
            ))}
          </div>
        </Section>

        <Section title="Modyfikacje" count={MODIFICATIONS.length}>
          <div className="space-y-3">
            {MODIFICATIONS.map((mod) => (
              <ModificationCard key={mod.id} modification={mod} />
            ))}
          </div>
        </Section>
      </div>
    </AppLayout>
  )
}
