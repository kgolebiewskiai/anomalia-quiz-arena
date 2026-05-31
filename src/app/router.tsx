import { createBrowserRouter } from 'react-router-dom'
import { HomePage } from '../features/home/HomePage'
import { DevCardsPage } from '../features/dev/DevCardsPage'
import { CreateRoomPage } from '../features/lobby/CreateRoomPage'
import { JoinRoomPage } from '../features/lobby/JoinRoomPage'
import { LobbyPage } from '../features/lobby/LobbyPage'
import { GamePage } from '../features/game/GamePage'
import { ScoreboardPage } from '../features/scoreboard/ScoreboardPage'
import { MatchmakingPage } from '../features/matchmaking/MatchmakingPage'

export const router = createBrowserRouter([
  {
    path: '/',
    element: <HomePage />,
  },
  {
    path: '/create-room',
    element: <CreateRoomPage />,
  },
  {
    path: '/join',
    element: <JoinRoomPage />,
  },
  {
    path: '/lobby/:code',
    element: <LobbyPage />,
  },
  {
    path: '/play/:code',
    element: <GamePage />,
  },
  {
    path: '/scoreboard/:code',
    element: <ScoreboardPage />,
  },
  {
    path: '/matchmaking',
    element: <MatchmakingPage />,
  },
  {
    path: '/dev/cards',
    element: <DevCardsPage />,
  },
  {
    path: '*',
    element: (
      <div className="flex items-center justify-center min-h-dvh text-anomaly-lavender text-lg">
        404 — Nie znaleziono
      </div>
    ),
  },
])
