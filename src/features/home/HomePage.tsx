import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { AppLayout } from '../../components/layout/AppLayout'
import { Button } from '../../components/ui/Button'
import { SetDisplayNameModal } from '../auth/SetDisplayNameModal'
import { useAuthStore } from '../../store/authStore'

export function HomePage() {
  const navigate = useNavigate()
  const { session, profile, isLoading } = useAuthStore()
  const [editingNick, setEditingNick] = useState(false)

  const needsNick = !isLoading && session && !profile

  return (
    <AppLayout>
      {(editingNick || needsNick) && session && (
        <SetDisplayNameModal
          userId={session.user.id}
          onDone={() => setEditingNick(false)}
        />
      )}

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

        {!isLoading && profile && (
          <button
            onClick={() => setEditingNick(true)}
            className="flex items-center gap-2 rounded-full border border-anomaly-primary/30 px-4 py-1.5 text-sm text-anomaly-lavender/70 hover:border-anomaly-primary/60 transition-colors"
          >
            <span className="text-anomaly-primary font-medium">{profile.display_name}</span>
            <span className="text-anomaly-lavender/40 text-xs">zmień nick</span>
          </button>
        )}

        {isLoading && (
          <p className="text-xs text-anomaly-lavender/30 animate-pulse">Łączenie…</p>
        )}

        <div className="w-full max-w-xs space-y-3">
          <Button
            disabled={isLoading || !session}
            onClick={() => navigate('/matchmaking')}
          >
            Szukaj gry ranked
          </Button>
          <Button
            variant="ghost"
            disabled={isLoading || !session}
            onClick={() => navigate('/create-room')}
          >
            Stwórz Komorę testową
          </Button>
          <Button
            variant="ghost"
            disabled={isLoading || !session}
            onClick={() => navigate('/join')}
          >
            Dołącz kodem
          </Button>
        </div>

        <p className="text-xs text-anomaly-lavender/30">Faza 11 — Matchmaking</p>
      </div>
    </AppLayout>
  )
}
