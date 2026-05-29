import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { HomePage } from '../features/home/HomePage'

function wrapper({ children }: { children: React.ReactNode }) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return (
    <QueryClientProvider client={qc}>
      <MemoryRouter>{children}</MemoryRouter>
    </QueryClientProvider>
  )
}

describe('HomePage', () => {
  it('renders ANOMALIA heading', () => {
    render(<HomePage />, { wrapper })
    expect(screen.getByRole('heading', { level: 1 })).toBeInTheDocument()
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('ANOMALIA')
  })

  it('shows Instytut Anomalii label', () => {
    render(<HomePage />, { wrapper })
    expect(screen.getByText(/Instytut Anomalii/i)).toBeInTheDocument()
  })

  it('shows Quiz Arena subtitle', () => {
    render(<HomePage />, { wrapper })
    expect(screen.getByText(/Quiz Arena/i)).toBeInTheDocument()
  })

  it('shows disabled CTA buttons', () => {
    render(<HomePage />, { wrapper })
    const buttons = screen.getAllByRole('button')
    expect(buttons.length).toBeGreaterThanOrEqual(2)
    buttons.forEach((btn) => expect(btn).toBeDisabled())
  })
})
