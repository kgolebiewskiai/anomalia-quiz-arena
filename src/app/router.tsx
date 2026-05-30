import { createBrowserRouter } from 'react-router-dom'
import { HomePage } from '../features/home/HomePage'
import { DevCardsPage } from '../features/dev/DevCardsPage'
import { CreateRoomPage } from '../features/lobby/CreateRoomPage'
import { JoinRoomPage } from '../features/lobby/JoinRoomPage'
import { LobbyPage } from '../features/lobby/LobbyPage'
import { CategoryVotePage } from '../features/categoryDraft/CategoryVotePage'
import { ProfileDraftPage } from '../features/profileDraft/ProfileDraftPage'
import { QuestionPage } from '../features/question/QuestionPage'
import { ModificationDraftPage } from '../features/modificationDraft/ModificationDraftPage'
import { ScoreboardPage } from '../features/scoreboard/ScoreboardPage'
import { AnomalyRevealPage } from '../features/anomalyReveal/AnomalyRevealPage'

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
    path: '/category-vote/:code',
    element: <CategoryVotePage />,
  },
  {
    path: '/profile-draft/:code',
    element: <ProfileDraftPage />,
  },
  {
    path: '/question/:code',
    element: <QuestionPage />,
  },
  {
    path: '/modification-draft/:code',
    element: <ModificationDraftPage />,
  },
  {
    path: '/scoreboard/:code',
    element: <ScoreboardPage />,
  },
  {
    path: '/anomaly-reveal/:code',
    element: <AnomalyRevealPage />,
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
