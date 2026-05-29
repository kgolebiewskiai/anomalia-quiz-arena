import { createBrowserRouter } from 'react-router-dom'
import { HomePage } from '../features/home/HomePage'

export const router = createBrowserRouter([
  {
    path: '/',
    element: <HomePage />,
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
