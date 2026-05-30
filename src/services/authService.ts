import { supabase } from './supabaseClient'

export interface PlayerProfile {
  id: string
  user_id: string
  display_name: string
  avatar_url: string | null
  created_at: string
  updated_at: string
}

export async function ensureAnonSession() {
  const { data: { session } } = await supabase.auth.getSession()
  if (session) return session

  const { data, error } = await supabase.auth.signInAnonymously()
  if (error) throw error
  return data.session
}

export async function getPlayerProfile(userId: string): Promise<PlayerProfile | null> {
  const { data, error } = await supabase
    .from('player_profiles')
    .select('*')
    .eq('user_id', userId)
    .maybeSingle()

  if (error) throw error
  return data
}

export async function setDisplayName(
  userId: string,
  displayName: string,
): Promise<PlayerProfile> {
  const trimmed = displayName.trim()
  if (trimmed.length < 2 || trimmed.length > 24) {
    throw new Error('Nick musi mieć od 2 do 24 znaków.')
  }

  const { data, error } = await supabase
    .from('player_profiles')
    .upsert(
      { user_id: userId, display_name: trimmed },
      { onConflict: 'user_id' },
    )
    .select()
    .single()

  if (error) throw error
  return data as PlayerProfile
}
