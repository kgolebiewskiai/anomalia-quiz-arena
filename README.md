# ANOMALIA: Quiz Arena

Realtime multiplayer quiz PWA dla 2–8 graczy. Każdy mecz to **Test** w klimacie tajemniczego **Instytutu Anomalii**.

## Status

| Faza | Opis | Status |
|------|------|--------|
| 1 | Bootstrap — Vite, Tailwind, PWA, routing, ekran startowy | ✅ |
| 2 | Statyczne karty Profili, Modyfikacji i Anomalii | — |
| 3 | Supabase local i migracje | — |
| 4–12 | Lobby, gra, scoring, ranking, deploy | — |

## Wymagania

- Node 22+
- pnpm 11+ (`npm install -g pnpm`)

## Uruchomienie

```bash
cp .env.example .env.local
# uzupełnij zmienne w .env.local (wymagane od Fazy 3)

pnpm install
pnpm dev
```

## Komendy

```bash
pnpm dev          # serwer deweloperski
pnpm build        # build produkcyjny (tsc + vite)
pnpm preview      # podgląd buildu
pnpm test         # testy (vitest run)
pnpm test:watch   # testy w trybie watch
pnpm lint         # ESLint
pnpm format       # Prettier
```

## Zmienne środowiskowe

| Zmienna | Opis |
|---------|------|
| `VITE_SUPABASE_URL` | URL projektu Supabase |
| `VITE_SUPABASE_ANON_KEY` | Anon key Supabase (nie service_role!) |
| `VITE_APP_ENV` | `local` / `production` |

Nigdy nie wkładaj `service_role` do frontendu.

## Struktura projektu

```
src/
  app/            # router, providers
  components/
    layout/       # AppLayout
    ui/           # Button, ...
  config/         # theme.ts, gameConstants.ts
  features/
    home/         # HomePage
    auth/         # (Faza 3)
    lobby/        # (Faza 4)
    ...
  lib/            # cn.ts i inne utility
  styles/         # globals.css (Tailwind v4)
  tests/          # Vitest unit tests
docs/
  anomalia_quiz_arena_claude_code_plan.md   # pełna specyfikacja gry
```

## Stack

- **Frontend**: Vite 8 · React 19 · TypeScript 6 (strict)
- **Styling**: Tailwind CSS v4 (`@tailwindcss/vite`)
- **Routing**: React Router v7
- **State**: Zustand · TanStack Query
- **Validation**: Zod
- **Backend (od Fazy 3)**: Supabase Auth · Postgres · Realtime
- **PWA**: vite-plugin-pwa
- **Tests**: Vitest · Testing Library
- **Deploy (Faza 12)**: Cloudflare Pages
