import { createContext, useContext } from 'react'
import type { Session } from '@supabase/supabase-js'
import type { Room, RoomPlayer } from '../../domain/types'

export interface GameContextValue {
  room: Room
  players: RoomPlayer[]
  session: Session
  code: string
  msLeft: number
  secondsLeft: number
}

export const GameContext = createContext<GameContextValue | null>(null)

export function useGame(): GameContextValue {
  const ctx = useContext(GameContext)
  if (!ctx) throw new Error('useGame must be used within a GameProvider')
  return ctx
}
