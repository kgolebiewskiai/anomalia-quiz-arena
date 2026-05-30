import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { useEffect, type ReactNode } from 'react'
import { supabase } from '../services/supabaseClient'
import { ensureAnonSession, getPlayerProfile } from '../services/authService'
import { useAuthStore } from '../store/authStore'

const queryClient = new QueryClient()

function AuthInit({ children }: { children: ReactNode }) {
  const { setSession, setProfile, setLoading } = useAuthStore()

  useEffect(() => {
    let mounted = true

    async function init() {
      try {
        const session = await ensureAnonSession()
        if (!mounted) return
        setSession(session)

        if (session?.user) {
          const profile = await getPlayerProfile(session.user.id)
          if (mounted) setProfile(profile)
        }
      } catch (err) {
        console.error('[auth] init error', err)
      } finally {
        if (mounted) setLoading(false)
      }
    }

    init()

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        if (!mounted) return
        setSession(session)
      },
    )

    return () => {
      mounted = false
      subscription.unsubscribe()
    }
  }, [setSession, setProfile, setLoading])

  return <>{children}</>
}

export function Providers({ children }: { children: ReactNode }) {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthInit>{children}</AuthInit>
    </QueryClientProvider>
  )
}
