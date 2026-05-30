import { create } from 'zustand'
import type { Session } from '@supabase/supabase-js'
import type { PlayerProfile } from '../services/authService'

interface AuthState {
  session: Session | null
  profile: PlayerProfile | null
  isLoading: boolean
  setSession: (session: Session | null) => void
  setProfile: (profile: PlayerProfile | null) => void
  setLoading: (loading: boolean) => void
}

export const useAuthStore = create<AuthState>((set) => ({
  session: null,
  profile: null,
  isLoading: true,
  setSession: (session) => set({ session }),
  setProfile: (profile) => set({ profile }),
  setLoading: (isLoading) => set({ isLoading }),
}))
