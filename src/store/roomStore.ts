import { create } from 'zustand'
import type { Room, RoomPlayer } from '../domain/types'

interface RoomState {
  room: Room | null
  players: RoomPlayer[]
  setRoom: (room: Room | null) => void
  setPlayers: (players: RoomPlayer[]) => void
  updatePlayer: (userId: string, patch: Partial<RoomPlayer>) => void
  addPlayer: (player: RoomPlayer) => void
  removePlayer: (userId: string) => void
  reset: () => void
}

export const useRoomStore = create<RoomState>((set) => ({
  room: null,
  players: [],

  setRoom: (room) => set({ room }),

  setPlayers: (players) => set({ players }),

  updatePlayer: (userId, patch) =>
    set((state) => ({
      players: state.players.map((p) =>
        p.user_id === userId ? { ...p, ...patch } : p
      ),
    })),

  addPlayer: (player) =>
    set((state) => ({
      players: state.players.some((p) => p.user_id === player.user_id)
        ? state.players.map((p) => (p.user_id === player.user_id ? player : p))
        : [...state.players, player],
    })),

  removePlayer: (userId) =>
    set((state) => ({
      players: state.players.filter((p) => p.user_id !== userId),
    })),

  reset: () => set({ room: null, players: [] }),
}))
