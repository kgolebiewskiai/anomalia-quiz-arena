import { AppLayout } from '../../components/layout/AppLayout'
import { Button } from '../../components/ui/Button'

export function HomePage() {
  return (
    <AppLayout>
      <div className="flex flex-1 flex-col items-center justify-center gap-8 py-12">
        <div className="space-y-3 text-center">
          <p className="text-xs tracking-widest text-anomaly-gold uppercase">
            Instytut Anomalii
          </p>
          <h1 className="text-5xl font-bold leading-tight text-anomaly-primary">
            ANOMALIA
          </h1>
          <p className="text-2xl font-semibold text-anomaly-lavender">
            Quiz Arena
          </p>
          <p className="mx-auto max-w-xs text-sm text-anomaly-lavender/60">
            Realtime multiplayer quiz dla 2–8 graczy. Wybierz Profil,
            odpowiadaj na pytania, zbieraj Modyfikacje.
          </p>
        </div>

        <div className="w-full max-w-xs space-y-3">
          <Button disabled>Stwórz Komorę testową</Button>
          <Button variant="ghost" disabled>
            Dołącz kodem
          </Button>
        </div>

        <p className="text-xs text-anomaly-lavender/30">Faza 1 — Bootstrap</p>
      </div>
    </AppLayout>
  )
}
