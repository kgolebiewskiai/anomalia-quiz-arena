# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
pnpm dev          # Vite dev server
pnpm build        # tsc -b && vite build
pnpm preview      # Preview the production build locally
pnpm test         # Single Vitest run
pnpm test:watch   # Vitest in watch mode
pnpm lint         # ESLint (flat config, ESLint 9+)
pnpm format       # Prettier --write .
```

## Architecture

**ANOMALIA: Quiz Arena** is a React 19 PWA — a multiplayer trivia game with a card draft + anomaly events system. Uses `pnpm`. Currently in Phase 1 (bootstrap); later phases add Supabase backend and deploy to Cloudflare Pages.

### Source layout

```
src/
  app/          # router.tsx (createBrowserRouter) + providers.tsx (QueryClient)
  components/   # layout/, ui/, cards/ — pure presentational components
  config/       # theme.ts (color consts), gameConstants.ts (rules: 12 questions, 2-8 players, etc.)
  data/         # profiles.ts, modifications.ts, anomalies.ts — static data (no API in Phase 1)
  domain/       # types.ts — all TypeScript interfaces (ProfileConfig, ModificationConfig, etc.)
  features/     # Feature-sliced pages: home/, dev/
  lib/          # cn.ts — clsx + tailwind-merge utility
  styles/       # globals.css — Tailwind v4 @theme tokens (anomaly-bg, anomaly-primary, etc.)
  tests/        # Vitest + @testing-library/react, setup.ts imports jest-dom
```

### Key patterns

**Routing**: React Router v7 `createBrowserRouter` in `src/app/router.tsx`. Routes: `/` (HomePage), `/dev/cards` (card preview sandbox), `*` (404). Add new pages as feature folders under `src/features/`.

**State**: TanStack Query v5 for server state (QueryClient in `Providers`); Zustand v5 for client game state (store not yet created — Phase 2+). Prefer Query for anything async/supabase, Zustand for in-memory game session state.

**Styling**: Tailwind CSS v4 via `@tailwindcss/vite`. Custom colors live in `src/styles/globals.css` under `@theme` (e.g. `--color-anomaly-primary`). Mirror any new colors in `src/config/theme.ts`. Use `cn()` from `src/lib/cn.ts` for conditional class merging.

**Types**: All domain types in `src/domain/types.ts`. Game rule numbers (point values, timings, player counts) in `src/config/gameConstants.ts` — never hardcode magic numbers.

**Card components**: ProfileCard, ModificationCard, AnomalyBanner follow the same `{ item, selected?, onClick? }` prop shape and `rounded-2xl border-2 transition` styling pattern.

### Environment variables

Defined in `.env.example`. All optional in Phase 1:
- `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY` — required in Phase 3+
- `VITE_APP_ENV` — `"local"` or `"production"`
