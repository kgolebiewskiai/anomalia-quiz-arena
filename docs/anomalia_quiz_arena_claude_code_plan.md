# ANOMALIA: Quiz Arena — plan dla Claude Code

## 0. Cel projektu

Zbuduj od zera grywalny prototyp PWA gry **ANOMALIA: Quiz Arena**.

Gra ma być mobilną, realtime’ową areną quizową dla 2–8 graczy. Każdy mecz to **Test** w klimacie tajemniczego **Instytutu Anomalii**. Gracze odpowiadają na te same pytania, wybierają **Profil** na start i **Modyfikacje** po pytaniach 3, 6 i 9. Każda rozgrywka ma dawać poczucie innego buildu, ale zasady muszą być czytelne i policzalne.

Najważniejsza zasada UX: każda karta Profilu i każda karta Modyfikacji musi mówić dokładnie, co robi liczbowo. Nie używaj opisów typu „lekko”, „trochę”, „znacznie”.

---

## 1. Nienegocjowalne założenia produktu

### Nazwa i klimat

- Nazwa aplikacji: **ANOMALIA: Quiz Arena**
- Świat gry: **Instytut Anomalii**
- Mecz: **Test**
- Lobby: **Komora testowa**
- Bohaterowie: **Profile**
- Augmenty: **Modyfikacje**
- Eventy rundy: **Anomalie**
- Kategorie pytań: **Zakres testu**

### Tryby

Na prototyp implementujemy jeden wspólny ruleset dla wszystkich wariantów:

- gra ze znajomymi przez kod/link/QR,
- casual,
- ranked później.

Casual i ranked mają identyczne zasady. Różnica: ranked zapisuje wynik do ratingu, casual nie.

### Format meczu

- liczba graczy: minimum 2, maksimum 8,
- liczba pytań: 12,
- wszyscy gracze dostają dokładnie to samo pytanie w danej rundzie,
- pytania są rozwiązywane równolegle,
- czas bazowy na pytanie: 15 sekund,
- pytanie może mieć modyfikowany czas przez Profil, Modyfikację lub Anomalię,
- Profil wybierany jest raz na początku Testu,
- Modyfikacje wybierane są po pytaniach 3, 6 i 9,
- gracz nie zna przyszłych opcji Modyfikacji,
- ten sam Profil może zostać wybrany przez kilku graczy,
- każdy gracz dostaje 3 losowe Profile do wyboru z puli 15,
- każdy gracz dostaje 3 losowe Modyfikacje do wyboru w każdym drafcie,
- Modyfikacje wybrane wcześniej nie powinny powtarzać się temu samemu graczowi,
- nie implementuj mini-ekonomii,
- nie implementuj monetyzacji,
- nie implementuj komentarzy po pytaniach,
- nie implementuj specjalnych trybów gry.

### Punktacja bazowa

- poprawna odpowiedź: +100 pkt,
- błędna odpowiedź: -25 pkt,
- brak odpowiedzi: 0 pkt,
- bonus za szybkość tylko przy poprawnej odpowiedzi,
- maksymalny bonus za szybkość: +50 pkt,
- wzór bonusu szybkości: `floor(50 * remainingMs / effectiveQuestionTimeMs)`,
- punkty mogą spaść poniżej 0,
- gracz musi widzieć breakdown punktów po pytaniu.

Przykład breakdownu:

```text
+100 poprawna odpowiedź
+31 szybkość
+40 Katalizator
x1.25 Opóźniona Reakcja
= 214 pkt
```

---

## 2. Rekomendowany stack techniczny

### Frontend

- Vite
- React
- TypeScript
- React Router
- Zustand
- Zod
- Tailwind CSS
- Supabase JS
- Vitest
- Playwright opcjonalnie po ustabilizowaniu flow
- vite-plugin-pwa

### Backend / baza / realtime

Na MVP:

- Supabase Auth
- Supabase Postgres
- Supabase Realtime
- Supabase SQL RPC / ewentualnie Edge Functions
- RLS na tabelach

Później, jeżeli realtime i ranked będą wymagały mocniejszej kontroli:

- Cloudflare Durable Objects jako silnik pokoi gry.

### Hosting

- Cloudflare Pages dla PWA.

### Uzasadnienie

To ma być tani prototyp. Frontend jest statyczny, backend jest serverless/managed, nie utrzymujemy własnego serwera 24/7. Kod powinien być napisany tak, żeby silnik pokoju dało się później przenieść z Supabase RPC/Realtime do Cloudflare Durable Objects bez przepisywania całej aplikacji.

---

## 3. Repozytorium i struktura katalogów

Utwórz repo:

```text
anomalia-quiz-arena/
  README.md
  package.json
  pnpm-lock.yaml
  .env.example
  .gitignore
  vite.config.ts
  tsconfig.json
  eslint.config.js
  index.html

  public/
    icons/
    manifest.webmanifest

  supabase/
    config.toml
    migrations/
      001_init.sql
      002_rls.sql
      003_rpc_game_flow.sql
      004_seed_static_content.sql
    seed.sql

  src/
    main.tsx
    App.tsx
    styles/
      globals.css

    app/
      router.tsx
      providers.tsx

    config/
      theme.ts
      gameConstants.ts

    data/
      profiles.ts
      modifications.ts
      anomalies.ts
      categories.ts

    domain/
      types.ts
      gameState.ts
      scoring.ts
      rng.ts
      effects/
        applyProfiles.ts
        applyModifications.ts
        applyAnomalies.ts
        effectEngine.ts

    services/
      supabaseClient.ts
      authService.ts
      roomService.ts
      realtimeService.ts
      gameService.ts

    store/
      authStore.ts
      roomStore.ts
      gameStore.ts

    components/
      ui/
      cards/
      layout/

    features/
      home/
      auth/
      lobby/
      categoryDraft/
      profileDraft/
      question/
      modificationDraft/
      results/
      leaderboard/
      admin/

    tests/
      scoring.test.ts
      effects.test.ts
      rng.test.ts
```

---

## 4. Pierwsze komendy startowe

Użyj pnpm.

```bash
pnpm create vite anomalia-quiz-arena --template react-ts
cd anomalia-quiz-arena
pnpm install
pnpm add @supabase/supabase-js @tanstack/react-query zustand zod react-router-dom clsx tailwind-merge lucide-react
pnpm add -D tailwindcss @tailwindcss/vite vite-plugin-pwa vitest jsdom @testing-library/react @testing-library/jest-dom eslint prettier typescript
```

Skonfiguruj:

- TypeScript strict mode,
- ESLint,
- Prettier,
- Vitest,
- Tailwind,
- PWA manifest,
- `.env.example`.

`.env.example`:

```text
VITE_SUPABASE_URL=
VITE_SUPABASE_ANON_KEY=
VITE_APP_ENV=local
```

Nigdy nie wkładaj `service_role` do frontendu.

---

## 5. Design system

Kierunek: ciemny, laboratoryjny, anomalny, ale czytelny.

Kolory bazowe:

```text
Dark purple: #20093A
Purple:      #AA93FF
Lavender:    #E3D2FF
Brown/gold:  #D9D3A7
```

Zasady UI:

- mobile-first,
- najważniejsze CTA w kolorze #AA93FF,
- tło #20093A,
- karty jasne lub półprzezroczyste na ciemnym tle,
- wszystkie wartości liczbowe na kartach wyróżnione,
- ekran pytania musi mieć bardzo czytelny timer,
- nigdy nie chowaj pełnego działania karty w tooltipie,
- tooltip może wyjaśniać szczegóły, ale karta musi być zrozumiała sama z siebie.

---

## 6. Model danych

### Enums

```sql
create type room_mode as enum ('friends', 'casual', 'ranked');
create type room_status as enum (
  'lobby',
  'category_vote',
  'profile_draft',
  'question_intro',
  'question_active',
  'question_results',
  'modification_draft',
  'finished',
  'cancelled'
);

create type question_type as enum (
  'single_choice',
  'true_false',
  'numeric',
  'order'
);
```

### Tabele statyczne

#### `profiles`

```sql
id text primary key,
name text not null,
style text not null,
passive_description text not null,
active_description text not null,
flavor text not null,
config jsonb not null,
is_enabled boolean not null default true,
created_at timestamptz not null default now()
```

#### `modifications`

```sql
id text primary key,
name text not null,
type text not null,
effect_description text not null,
duration_description text not null,
flavor text not null,
config jsonb not null,
is_enabled boolean not null default true,
created_at timestamptz not null default now()
```

#### `anomalies`

```sql
id text primary key,
name text not null,
effect_description text not null,
config jsonb not null,
is_enabled boolean not null default true
```

#### `categories`

```sql
id uuid primary key default gen_random_uuid(),
name text not null unique,
is_enabled boolean not null default true
```

#### `questions`

```sql
id uuid primary key default gen_random_uuid(),
type question_type not null,
category_id uuid references categories(id),
difficulty text not null check (difficulty in ('easy', 'medium', 'hard')),
question_text text not null,
options jsonb,
correct_answer jsonb not null,
tolerance numeric,
explanation text,
is_ranked_safe boolean not null default false,
is_enabled boolean not null default true,
created_at timestamptz not null default now()
```

Dla `single_choice`:

```json
{
  "options": [
    {"id": "A", "text": "..."},
    {"id": "B", "text": "..."},
    {"id": "C", "text": "..."},
    {"id": "D", "text": "..."}
  ],
  "correct_answer": {"id": "B"}
}
```

Dla `numeric`:

```json
{
  "correct_answer": {"value": 42},
  "tolerance": 2
}
```

Dla `order`:

```json
{
  "options": [
    {"id": "A", "text": "..."},
    {"id": "B", "text": "..."},
    {"id": "C", "text": "..."}
  ],
  "correct_answer": {"order": ["C", "A", "B"]}
}
```

### Tabele gry

#### `player_profiles`

Dane publiczne gracza.

```sql
id uuid primary key default gen_random_uuid(),
user_id uuid references auth.users(id) not null unique,
display_name text not null,
avatar_url text,
created_at timestamptz not null default now(),
updated_at timestamptz not null default now()
```

#### `rooms`

```sql
id uuid primary key default gen_random_uuid(),
code text not null unique,
mode room_mode not null,
status room_status not null default 'lobby',
host_user_id uuid references auth.users(id) not null,
seed text not null,
max_players int not null default 8 check (max_players between 2 and 8),
current_question_index int not null default 0,
current_phase_started_at timestamptz,
current_phase_duration_ms int,
active_anomaly_id text references anomalies(id),
settings jsonb not null default '{}',
created_at timestamptz not null default now(),
started_at timestamptz,
finished_at timestamptz
```

#### `room_players`

```sql
id uuid primary key default gen_random_uuid(),
room_id uuid references rooms(id) on delete cascade not null,
user_id uuid references auth.users(id) not null,
display_name text not null,
slot int not null,
selected_profile_id text references profiles(id),
score int not null default 0,
streak int not null default 0,
is_connected boolean not null default true,
is_ready boolean not null default false,
joined_at timestamptz not null default now(),
left_at timestamptz,
unique(room_id, user_id),
unique(room_id, slot)
```

#### `room_category_votes`

```sql
id uuid primary key default gen_random_uuid(),
room_id uuid references rooms(id) on delete cascade not null,
user_id uuid references auth.users(id) not null,
category_id uuid references categories(id) not null,
created_at timestamptz not null default now(),
unique(room_id, user_id)
```

#### `room_questions`

```sql
id uuid primary key default gen_random_uuid(),
room_id uuid references rooms(id) on delete cascade not null,
question_id uuid references questions(id) not null,
question_index int not null check (question_index between 1 and 12),
anomaly_id text references anomalies(id),
created_at timestamptz not null default now(),
unique(room_id, question_index)
```

#### `room_profile_options`

```sql
id uuid primary key default gen_random_uuid(),
room_id uuid references rooms(id) on delete cascade not null,
user_id uuid references auth.users(id) not null,
profile_ids text[] not null,
created_at timestamptz not null default now(),
unique(room_id, user_id)
```

#### `room_modification_options`

```sql
id uuid primary key default gen_random_uuid(),
room_id uuid references rooms(id) on delete cascade not null,
user_id uuid references auth.users(id) not null,
draft_stage int not null check (draft_stage in (3,6,9)),
modification_ids text[] not null,
selected_modification_id text references modifications(id),
created_at timestamptz not null default now(),
selected_at timestamptz,
unique(room_id, user_id, draft_stage)
```

#### `player_modifications`

```sql
id uuid primary key default gen_random_uuid(),
room_id uuid references rooms(id) on delete cascade not null,
user_id uuid references auth.users(id) not null,
modification_id text references modifications(id) not null,
draft_stage int not null check (draft_stage in (3,6,9)),
remaining_questions int,
uses_remaining int,
state jsonb not null default '{}',
created_at timestamptz not null default now()
```

#### `answers`

```sql
id uuid primary key default gen_random_uuid(),
room_id uuid references rooms(id) on delete cascade not null,
user_id uuid references auth.users(id) not null,
question_index int not null,
question_id uuid references questions(id) not null,
answer jsonb not null,
is_correct boolean not null,
answered_at timestamptz not null default now(),
response_ms int not null,
base_points int not null,
speed_bonus int not null,
flat_bonus int not null default 0,
multiplier numeric not null default 1,
penalty int not null default 0,
total_points int not null,
breakdown jsonb not null,
created_at timestamptz not null default now(),
unique(room_id, user_id, question_index)
```

#### `ratings`

```sql
id uuid primary key default gen_random_uuid(),
user_id uuid references auth.users(id) not null unique,
rating int not null default 1000,
games_played int not null default 0,
wins int not null default 0,
updated_at timestamptz not null default now()
```

---

## 7. RLS i bezpieczeństwo

Włącz RLS na tabelach dynamicznych.

Minimalne zasady:

- zalogowany anonimowo użytkownik może odczytać pokoje, w których jest graczem,
- użytkownik może odczytać publiczne statyczne tabele: `profiles`, `modifications`, `anomalies`, `categories`,
- użytkownik może odczytać pytanie aktywne w pokoju, w którym gra,
- użytkownik nie może zobaczyć przyszłych pytań przed czasem,
- użytkownik może zaktualizować tylko swój rekord w `room_players`,
- użytkownik może wysłać tylko swoją odpowiedź,
- użytkownik nie może samodzielnie zmienić wyniku,
- wynik liczy RPC albo Edge Function,
- stan pokoju zmienia tylko RPC `advance_room_phase`,
- klient nigdy nie oblicza finalnego wyniku jako źródło prawdy.

Supabase Auth ma wspierać anonimowe logowanie. Nie wymagaj konta na początku. Po wejściu do aplikacji:

1. sprawdź, czy istnieje sesja,
2. jeśli nie, wykonaj anonimowe logowanie,
3. zapisz albo pobierz `player_profiles`,
4. pozwól ustawić `display_name`.

---

## 8. Realtime i synchronizacja czasu

Nie wysyłaj ticków timera co sekundę przez realtime.

Zamiast tego:

- w `rooms` trzymaj `current_phase_started_at`,
- w `rooms` trzymaj `current_phase_duration_ms`,
- klient raz na jakiś czas synchronizuje offset z serwerem przez RPC `get_server_time`,
- timer liczony jest lokalnie z timestampów serwera,
- Realtime wysyła tylko zmiany faz, odpowiedzi, wyniki i drafty.

Kanał realtime:

```text
room:{roomCode}
```

Eventy:

```text
player_joined
player_left
room_updated
phase_changed
answer_submitted
question_resolved
modification_options_created
modification_selected
game_finished
```

Ważne: Supabase Realtime liczy wiadomości, więc minimalizuj broadcasty. Nie emituj timera.

---

## 9. RPC / funkcje backendowe

Zaimplementuj jako SQL RPC lub Edge Functions. Preferowane na start: SQL RPC z SECURITY DEFINER, jeśli jest czytelne i bezpieczne.

### `create_room(mode, max_players)`

Tworzy pokój z kodem 6 znaków.

Zwraca:

```json
{
  "room_id": "...",
  "code": "A7K2Q9"
}
```

### `join_room(code, display_name)`

Dodaje gracza do pokoju, jeśli:

- pokój istnieje,
- status = lobby,
- liczba graczy < max_players,
- użytkownik nie jest już w pokoju.

### `start_room(room_id)`

Tylko host.

Kroki:

1. sprawdź minimum 2 graczy,
2. ustaw status `category_vote`,
3. ustaw czas fazy,
4. wygeneruj listę kategorii do głosowania.

### `submit_category_vote(room_id, category_id)`

Zapisuje jeden głos gracza.

### `prepare_profile_draft(room_id)`

Tworzy 3 opcje Profilu dla każdego gracza:

- bez duplikatów w obrębie jednego gracza,
- duplikaty między graczami dozwolone,
- deterministyczne na podstawie `room.seed`.

### `select_profile(room_id, profile_id)`

Pozwala wybrać tylko Profil z opcji danego gracza.

### `prepare_questions(room_id)`

Tworzy 12 pytań na podstawie wybranych kategorii.

Zasady:

- wszyscy gracze mają tę samą listę pytań,
- pytania nie powtarzają się w meczu,
- jeśli brakuje pytań w wybranych kategoriach, dobierz z innych aktywnych kategorii,
- zapisz w `room_questions`.

### `start_question(room_id, question_index)`

Ustawia:

- `status = question_active`,
- `current_question_index`,
- `current_phase_started_at = now()`,
- `current_phase_duration_ms = calculated`.

### `submit_answer(room_id, question_index, answer)`

Waliduje:

- użytkownik należy do pokoju,
- status = question_active,
- pytanie jest aktualne,
- odpowiedź nie została już złożona,
- czas nie minął.

Następnie:

1. oblicza poprawność,
2. oblicza response_ms,
3. oblicza punkty,
4. zapisuje breakdown,
5. aktualizuje `room_players.score`,
6. aktualizuje streak,
7. zapisuje answer.

### `advance_room_phase(room_id)`

Idempotentna funkcja przejścia fazy.

Może zostać wywołana przez dowolnego gracza, ale sama sprawdza warunki:

- jeśli wszyscy aktywni gracze odpowiedzieli albo czas minął, przejdź do results,
- po krótkim results przejdź do draftu Modyfikacji po pytaniach 3, 6, 9,
- po innych pytaniach przejdź do następnego pytania,
- po pytaniu 12 zakończ mecz.

### `prepare_modification_draft(room_id, draft_stage)`

Tworzy 3 opcje Modyfikacji dla każdego gracza:

- draft_stage = 3, 6 albo 9,
- nie pokazuj Modyfikacji już wybranej przez tego gracza,
- zapisz opcje dopiero na danym etapie,
- gracz wcześniej nie zna przyszłych opcji.

### `select_modification(room_id, draft_stage, modification_id)`

Pozwala wybrać Modyfikację tylko z aktualnej trójki opcji.

### `finish_room(room_id)`

Kończy grę.

Jeśli `mode = ranked`, aktualizuje rating.

---

## 10. Deterministyczne losowanie

Stwórz `src/domain/rng.ts`.

Nie używaj `Math.random()` do logiki gry.

Użyj seedowanego RNG, np. prostej funkcji `mulberry32` albo `seedrandom`.

Przykładowe seedy:

```text
profile options:
{roomSeed}:profile:{userId}

modification options:
{roomSeed}:modification:{userId}:{draftStage}

question order:
{roomSeed}:questions

anomalies:
{roomSeed}:anomalies
```

Losowe decyzje generowane w backendzie muszą zostać zapisane w DB. Klient tylko renderuje zapisane opcje.

---

## 11. Typy pytań

Implementuj etapami.

### Etap 1

- `single_choice`
- `true_false`

### Etap 2

- `numeric`

### Etap 3

- `order`

Zasady:

- wszyscy gracze mają ten sam typ pytania w danej rundzie,
- pytania z obrazem/audio zostaw na później,
- dla `numeric` odpowiedź jest poprawna, jeśli mieści się w tolerancji,
- dla `order` odpowiedź jest poprawna tylko przy dokładnej kolejności.

---

## 12. Profile — pula 15 na MVP

Każda karta musi mieć nazwę, styl, pasywną, aktywną i flavor.

### 1. Chronotyp

Styl: czas

Pasywna:
Masz +1 sekundę na każde pytanie.

Aktywna:
Raz na Test dodaj sobie +4 sekundy do aktualnego pytania. Możesz użyć przed udzieleniem odpowiedzi.

Flavor:
„Czas nie płynie szybciej. Ty płyniesz wolniej.”

### 2. Katalizator

Styl: modyfikacje

Pasywna:
Pierwsza poprawna odpowiedź po wybraniu każdej Modyfikacji daje dodatkowe +40 pkt.

Aktywna:
Raz na Test, jeśli masz co najmniej jedną aktywną Modyfikację, Twoja następna poprawna odpowiedź daje dodatkowe +60 pkt.

Flavor:
„Reakcja zaczyna się dopiero po kontakcie z decyzją.”

### 3. Stabilizator

Styl: obrona

Pasywna:
Pierwsze 2 błędne odpowiedzi w Teście mają karę zmniejszoną o 50%.

Aktywna:
Raz na Test anuluj bazową karę za błędną odpowiedź w aktualnym pytaniu. Nie anuluje dodatkowych kar z Modyfikacji.

Flavor:
„Nie zapobiega błędom. Zmniejsza rozmiar krateru.”

### 4. Spektrometr

Styl: informacja

Pasywna:
Przed każdym pytaniem widzisz kategorię 2 sekundy wcześniej niż inni gracze.

Aktywna:
2 razy na Test zobacz poziom trudności aktualnego pytania przed odpowiedzią.

Flavor:
„Nie zna odpowiedzi. Zna kształt problemu.”

### 5. Replikant

Styl: kopiowanie

Pasywna:
Po każdej rundzie draftu widzisz, którą Modyfikację wybrał aktualny lider.

Aktywna:
Raz na Test skopiuj aktywną Modyfikację wybranego gracza. Skopiowana Modyfikacja ma 50% wartości punktowych/procentowych. Czas działania bez zmian.

Flavor:
„Oryginał był tylko pierwszą wersją.”

### 6. Operator Pola

Styl: anty-PvP

Pasywna:
Negatywne efekty PvP skierowane w Ciebie trwają o 1 pytanie krócej. Minimum to 1 pytanie.

Aktywna:
Raz na Test zablokuj jeden negatywny efekt PvP skierowany w Ciebie. Możesz użyć po zobaczeniu efektu.

Flavor:
„Pole nie jest bezpieczne. Jest kontrolowane.”

### 7. Synapsa

Styl: seria

Pasywna:
Za każdą serię 3 poprawnych odpowiedzi z rzędu dostajesz dodatkowe +60 pkt.

Aktywna:
Raz na Test zabezpiecz aktualną serię. Następna błędna odpowiedź nie resetuje serii.

Flavor:
„Jedna odpowiedź to impuls. Trzy to wzorzec.”

### 8. Null

Styl: reset

Pasywna:
Raz na Test pierwsza błędna odpowiedź nie daje bazowej kary punktowej.

Aktywna:
Raz na Test usuń jeden aktywny negatywny efekt PvP. Nie usuwa kosztów Modyfikacji wybranych przez Ciebie.

Flavor:
„Brak sygnału też jest wynikiem.”

### 9. Wektor

Styl: szybkość

Pasywna:
Odpowiedź w pierwszych 4 sekundach daje dodatkowe +25 pkt, jeśli jest poprawna.

Aktywna:
Raz na Test podwój swój bonus za szybkość w aktualnym pytaniu. Maksymalny dodatkowy zysk z tej aktywnej umiejętności: +50 pkt.

Flavor:
„Kierunek jest ważny. Prędkość też.”

### 10. Archiwista

Styl: kategorie

Pasywna:
Jeśli dwa pytania z rzędu są z tej samej kategorii, poprawna odpowiedź w drugim pytaniu daje dodatkowe +50 pkt.

Aktywna:
Raz na Test przed pytaniem wybierz jedną z dwóch kategorii. Następne pytanie będzie z wybranej kategorii dla wszystkich graczy.

Flavor:
„Wszystko już gdzieś było. Trzeba tylko wiedzieć gdzie.”

### 11. Fraktal

Styl: comeback

Pasywna:
Jeśli jesteś w dolnej połowie tabeli, poprawna odpowiedź daje dodatkowe +30 pkt.

Aktywna:
Raz na Test, jeśli jesteś na ostatnim miejscu, następna poprawna odpowiedź daje dodatkowe +100 pkt.

Flavor:
„Każda porażka zawiera mniejszą wersję powrotu.”

### 12. Obserwator

Styl: informacja

Pasywna:
Po 5 sekundach pytania widzisz, ilu graczy już odpowiedziało.

Aktywna:
Raz na Test po 6 sekundach pytania zobacz, ile osób wybrało każdą odpowiedź. Twoje punkty za to pytanie są zmniejszone o 30%.

Flavor:
„Pomiar zmienia wynik. Czasem warto.”

### 13. Przekaźnik

Styl: wydłużanie efektów

Pasywna:
Pierwsza Modyfikacja czasowa, którą wybierzesz, trwa o 1 pytanie dłużej.

Aktywna:
Raz na Test wydłuż aktualnie aktywną Modyfikację czasową o 1 pytanie. Nie działa na Modyfikacje jednorazowe.

Flavor:
„Sygnał nie ginie. Zmienia nośnik.”

### 14. Horyzont

Styl: końcówka

Pasywna:
W pytaniach 10–12 Twoje poprawne odpowiedzi dają +20% punktów.

Aktywna:
Raz na Test przed pytaniem 10, 11 albo 12 zwiększ swój bonus końcowy do +40% na jedno pytanie.

Flavor:
„Najważniejsze dane pojawiają się przy granicy.”

### 15. Izolator

Styl: odporność

Pasywna:
Pierwszy negatywny efekt PvP w Teście nie działa na Ciebie.

Aktywna:
Raz na Test przez następne 2 pytania nie możesz być celem efektów PvP.

Flavor:
„Próbka została odseparowana od chaosu.”

---

## 13. Modyfikacje — pula startowa 24

### 1. Próg Pewności

Typ: Ryzyko

Efekt:
Przez następne 2 pytania:
- poprawna odpowiedź daje +50% punktów,
- błędna odpowiedź zabiera dodatkowe -75 pkt.

Czas działania:
2 pytania

Flavor:
„Instytut zaleca pewność. Instytut nie refunduje pomyłek.”

### 2. Opóźniona Reakcja

Typ: Skalowanie

Efekt:
Nie odpowiadasz na następne 2 pytania. Od kolejnego pytania do końca Testu Twoje poprawne odpowiedzi dają +25% punktów.

Czas działania:
Do końca Testu po zakończeniu blokady.

Flavor:
„Brak reakcji też jest reakcją. Tylko później.”

### 3. Redukcja Szumu

Typ: Podpowiedź

Efekt:
2 razy do końca Testu możesz usunąć jedną błędną odpowiedź. Działa tylko w pytaniach `single_choice`.

Czas działania:
Do wykorzystania 2 razy.

Flavor:
„Nie pokazuje prawdy. Usuwa część kłamstw.”

### 4. Kalibracja Odruchu

Typ: Szybkość

Efekt:
Do końca Testu odpowiedź w pierwszych 4 sekundach daje dodatkowe +35 pkt, jeśli jest poprawna.

Czas działania:
Do końca Testu.

Flavor:
„Odruch zatwierdzony. Rozsądek w kolejce.”

### 5. Bezpiecznik

Typ: Obrona

Efekt:
Pierwsza błędna odpowiedź po wybraniu tej Modyfikacji nie daje bazowej kary punktowej.

Czas działania:
Do aktywacji albo do końca Testu.

Flavor:
„Pomyłka została przewidziana. To niepokojące.”

### 6. Reakcja Łańcuchowa

Typ: Seria

Efekt:
Do końca Testu każda kolejna poprawna odpowiedź z rzędu daje narastający bonus:
- 2. poprawna z rzędu: +20 pkt,
- 3. poprawna z rzędu: +40 pkt,
- 4. i kolejne: +60 pkt.

Błędna odpowiedź resetuje bonus do 0.

Czas działania:
Do końca Testu.

Flavor:
„Jeden impuls to przypadek. Cztery to procedura.”

### 7. Akcelerator Decyzji

Typ: Ryzyko / czas

Efekt:
Przez następne 3 pytania:
- masz -3 sekundy na odpowiedź,
- poprawna odpowiedź daje +40% punktów.

Czas działania:
3 pytania.

Flavor:
„Szybciej nie znaczy lepiej. Ale czasem wystarczy.”

### 8. Stabilizacja Wyniku

Typ: Obrona

Efekt:
Przez następne 4 pytania błędna odpowiedź zabiera o 50 pkt mniej. Redukcja nie może zmienić kary w bonus.

Czas działania:
4 pytania.

Flavor:
„Upadek kontrolowany nadal jest upadkiem.”

### 9. Skan Trudności

Typ: Informacja

Efekt:
Do końca Testu przed każdym pytaniem widzisz poziom trudności: łatwe / średnie / trudne.

Czas działania:
Do końca Testu.

Flavor:
„Nie mówi, co jest prawdą. Mówi, jak bardzo zaboli.”

### 10. Interferencja Lidera

Typ: PvP

Efekt:
Gracz na 1. miejscu ma -3 sekundy na odpowiedź w następnym pytaniu.

Czas działania:
1 pytanie.

Flavor:
„Zakłócenie dotyczy wyłącznie obiektu o najwyższej energii.”

### 11. Zakłócenie Kanału

Typ: PvP

Efekt:
Wybrany gracz traci 30% bonusu za szybkość w następnych 2 pytaniach.

Czas działania:
2 pytania.

Flavor:
„Sygnał dotarł. Tylko nie tam, gdzie trzeba.”

### 12. Transfer Impulsu

Typ: PvP / szybkość

Efekt:
Przez następne 3 pytania, jeśli odpowiesz poprawnie szybciej niż aktualny lider, dostajesz dodatkowe +40 pkt.

Czas działania:
3 pytania.

Flavor:
„Energia lidera została uznana za zasób wspólny.”

### 13. Odwrócenie Polaryzacji

Typ: Obrona / PvP

Efekt:
Następny negatywny efekt PvP skierowany w Ciebie wraca do nadawcy. Efekt działa tylko raz.

Czas działania:
Do aktywacji albo do końca Testu.

Flavor:
„Kierunek zakłócenia został skorygowany.”

### 14. Druga Próba

Typ: Podpowiedź

Efekt:
Raz do końca Testu możesz zmienić odpowiedź przed końcem czasu. Jeśli po zmianie odpowiedź jest poprawna, dostajesz tylko 50% punktów za to pytanie.

Czas działania:
1 użycie.

Flavor:
„Instytut dopuszcza wahanie. Z rabatem.”

### 15. Pętla Testowa

Typ: Obrona / czas

Efekt:
Następna błędna odpowiedź nie daje bazowej kary, a w kolejnym pytaniu masz +3 sekundy.

Czas działania:
Do aktywacji albo do końca Testu.

Flavor:
„Błąd zapisano jako próbę wstępną.”

### 16. Odbicie Sygnału

Typ: Comeback / PvP

Efekt:
Po otrzymaniu negatywnego efektu PvP Twoja następna poprawna odpowiedź daje dodatkowe +75 pkt.

Czas działania:
Do aktywacji albo do końca Testu.

Flavor:
„Zakłócenie wróciło w formie danych.”

### 17. Kompensacja Deficytu

Typ: Comeback

Efekt:
Do końca Testu, jeśli jesteś w dolnej połowie tabeli, poprawna odpowiedź daje +25% punktów.

Czas działania:
Do końca Testu.

Flavor:
„Niski wynik zwiększa podatność na korektę.”

### 18. Próba Krytyczna

Typ: Ryzyko

Efekt:
W następnym pytaniu:
- poprawna odpowiedź daje dodatkowe +100 pkt,
- błędna odpowiedź zabiera dodatkowe -100 pkt.

Czas działania:
1 pytanie.

Flavor:
„Parametry testu przekroczyły zdrowy rozsądek.”

### 19. Tarcza Fazowa

Typ: Obrona

Efekt:
Przez następne 2 pytania nie możesz być celem efektów PvP.

Czas działania:
2 pytania.

Flavor:
„Obiekt obecny. Kontakt niemożliwy.”

### 20. Analiza Wstępna

Typ: Informacja

Efekt:
Przez następne 4 pytania widzisz kategorię 3 sekundy przed rozpoczęciem pytania.

Czas działania:
4 pytania.

Flavor:
„Przygotowanie nie jest odpowiedzią. Ale pomaga.”

### 21. Wzmocnienie Sygnału

Typ: Punkty

Efekt:
Przez następne 3 pytania poprawna odpowiedź daje dodatkowe +30 pkt.

Czas działania:
3 pytania.

Flavor:
„Sygnał podniesiony powyżej normy.”

### 22. Nadpisanie Wyniku

Typ: Ryzyko / odroczenie

Efekt:
Następna poprawna odpowiedź zapisuje dodatkowe +100 pkt w buforze. Punkty zostaną wypłacone po 2 kolejnych pytaniach, jeśli w tym czasie nie odpowiesz błędnie. Błąd usuwa bufor.

Czas działania:
Do rozliczenia bufora.

Flavor:
„Wynik zostanie zatwierdzony po kontroli.”

### 23. Cichy Protokół

Typ: Informacja / comeback

Efekt:
Przez następne 2 pytania tabela wyników jest ukryta dla wszystkich. Jeśli nie jesteś liderem, Twoja poprawna odpowiedź daje dodatkowe +40 pkt.

Czas działania:
2 pytania.

Flavor:
„Brak danych zmniejsza panikę. Czasem.”

### 24. Rezonans Końcowy

Typ: Końcówka

Efekt:
W pytaniach 10–12, jeśli nie jesteś na 1. miejscu, poprawna odpowiedź daje +30% punktów.

Czas działania:
Do końca Testu, ale działa tylko w pytaniach 10–12.

Flavor:
„Im bliżej końca, tym głośniej drga wynik.”

---

## 14. Anomalie — pula startowa 6

Na MVP Anomalie pojawiają się 2 razy w Teście: przed pytaniem 4 i przed pytaniem 8. Anomalia jest wspólna dla wszystkich graczy.

### 1. Niestabilne Pole

Efekt:
Wszyscy gracze mają -2 sekundy na odpowiedź w tym pytaniu.

### 2. Wzmocnienie Sygnału

Efekt:
Maksymalny bonus za szybkość w tym pytaniu wynosi +75 pkt zamiast +50 pkt.

### 3. Próba Kontrolna

Efekt:
W tym pytaniu nie działają negatywne efekty PvP.

### 4. Fluktuacja Wyniku

Efekt:
W tym pytaniu poprawna odpowiedź daje +20% punktów, a błędna odpowiedź zabiera dodatkowe -25 pkt.

### 5. Cisza Pomiarowa

Efekt:
Po tym pytaniu tabela wyników jest ukryta do rozpoczęcia następnego pytania.

### 6. Przesunięcie Fazowe

Efekt:
W tym pytaniu bonus za szybkość nie działa. Poprawna odpowiedź daje bazowo +125 pkt zamiast +100 pkt.

---

## 15. Kategorie startowe

Utwórz aktywne kategorie:

- Historia
- Geografia
- Nauka
- Sport
- Popkultura
- Film i TV
- Gry
- Technologia
- Muzyka
- Ogólne

Na start wystarczy import CSV/JSON z pytaniami. Nie twórz ręcznie wielkiego edytora pytań w pierwszym etapie.

---

## 16. Kolejność implementacji

### Faza 1 — Bootstrap projektu

Cel:
Uruchomić pustą aplikację PWA.

Zadania:

- utwórz Vite React TS,
- dodaj Tailwind,
- dodaj routing,
- dodaj prosty layout,
- dodaj PWA manifest,
- dodaj podstawową stronę Home,
- dodaj README,
- dodaj `.env.example`,
- dodaj test smoke.

Kryteria akceptacji:

- `pnpm dev` działa,
- `pnpm build` działa,
- `pnpm test` działa,
- aplikacja pokazuje ekran startowy ANOMALIA: Quiz Arena,
- mobile viewport wygląda poprawnie.

### Faza 2 — Statyczne karty Profili, Modyfikacji i Anomalii

Cel:
Zbudować model kart i ekran podglądu contentu.

Zadania:

- zdefiniuj typy `ProfileConfig`, `ModificationConfig`, `AnomalyConfig`,
- dodaj 15 Profili,
- dodaj 24 Modyfikacje,
- dodaj 6 Anomalii,
- zbuduj komponent `ProfileCard`,
- zbuduj komponent `ModificationCard`,
- zbuduj komponent `AnomalyBanner`,
- dodaj dev route `/dev/cards`.

Kryteria akceptacji:

- każda karta pokazuje konkretny efekt liczbowy,
- żadna karta nie używa słów „lekko”, „trochę”, „znacznie”,
- karty mieszczą się na mobile,
- snapshot/manual review kart przechodzi.

### Faza 3 — Supabase local i migracje

Cel:
Uruchomić bazę i auth.

Zadania:

- zainicjalizuj Supabase CLI,
- dodaj migracje schema,
- dodaj RLS,
- dodaj seed static content,
- skonfiguruj anonimowe logowanie,
- dodaj `supabaseClient.ts`,
- dodaj `authService.ts`,
- na starcie aplikacji wykonuj anonimowy login, jeśli nie ma sesji,
- dodaj ustawianie display name.

Kryteria akceptacji:

- lokalna baza startuje,
- migracje przechodzą,
- aplikacja tworzy anonimowego użytkownika,
- użytkownik może ustawić nick,
- nie ma `service_role` w kodzie frontendu.

### Faza 4 — Lobby i gra ze znajomymi

Cel:
Umożliwić stworzenie i dołączenie do Komory testowej.

Zadania:

- implementuj `create_room`,
- implementuj `join_room`,
- zbuduj ekran Create Room,
- zbuduj ekran Join Room,
- zbuduj lobby z listą graczy,
- dodaj kod pokoju,
- dodaj przycisk kopiowania linku,
- QR zostaw jako prosty etap późniejszy albo użyj biblioteki po zakończeniu core.

Kryteria akceptacji:

- gracz A tworzy pokój,
- gracz B dołącza kodem,
- lista graczy aktualizuje się realtime,
- host może rozpocząć grę przy minimum 2 graczach,
- maksimum 8 graczy działa.

### Faza 5 — Draft kategorii i Profili

Cel:
Przygotować początek Testu.

Zadania:

- ekran głosowania kategorii,
- każdy gracz wybiera 1 preferowaną kategorię,
- po głosowaniu backend generuje zakres testu,
- wygeneruj 3 Profile dla każdego gracza,
- ekran wyboru Profilu,
- zapisz wybrany Profil.

Kryteria akceptacji:

- każdy gracz widzi 3 Profile,
- gracz nie widzi opcji innych graczy jako własnych,
- wybrany Profil zapisuje się w DB,
- kilku graczy może wybrać ten sam Profil,
- Test nie startuje, dopóki wszyscy aktywni gracze nie wybiorą Profilu albo nie minie timeout.

### Faza 6 — Pytania i podstawowa punktacja

Cel:
Zagrać pełny Test bez Modyfikacji.

Zadania:

- wygeneruj 12 pytań dla pokoju,
- ekran pytania,
- timer oparty o timestamp serwera,
- obsługa `single_choice` i `true_false`,
- RPC `submit_answer`,
- scoring bazowy,
- ekran wyników po pytaniu,
- final scoreboard po pytaniu 12.

Kryteria akceptacji:

- wszyscy gracze widzą to samo pytanie,
- odpowiedzi liczą się tylko w czasie aktywnego pytania,
- odpowiedź po czasie jest odrzucana,
- wynik liczony jest po stronie backendu,
- breakdown punktów jest widoczny,
- pełny Test 12 pytań da się ukończyć.

### Faza 7 — Draft Modyfikacji po pytaniu 3, 6 i 9

Cel:
Dodać główny element regrywalności.

Zadania:

- po pytaniu 3 przejdź do `modification_draft`,
- wygeneruj 3 Modyfikacje dla każdego gracza,
- zapisz wybór,
- powtórz po pytaniu 6 i 9,
- nie generuj opcji na przyszłe drafty wcześniej,
- wybrane Modyfikacje aktywuj zgodnie z configiem.

Kryteria akceptacji:

- draft pojawia się dokładnie po pytaniach 3, 6, 9,
- gracz widzi tylko aktualne 3 opcje,
- future options nie istnieją w DB przed danym draftem,
- gracz nie dostaje ponownie Modyfikacji już wybranej,
- wybór wpływa na kolejne pytania.

### Faza 8 — Effect Engine

Cel:
Obsłużyć działanie Profili, Modyfikacji i Anomalii.

Zadania:

- zbuduj `effectEngine.ts`,
- zdefiniuj kolejność aplikowania efektów,
- zaimplementuj profile pasywne,
- zaimplementuj profile aktywne,
- zaimplementuj 24 Modyfikacje,
- zaimplementuj 6 Anomalii,
- dodaj testy jednostkowe dla każdego efektu.

Kolejność aplikowania punktów:

1. walidacja odpowiedzi,
2. base score,
3. speed bonus,
4. flat bonuses,
5. percentage multipliers,
6. penalties,
7. shields/reductions,
8. delayed buffers,
9. final total.

Kryteria akceptacji:

- każdy Profil ma test,
- każda Modyfikacja ma test,
- każda Anomalia ma test,
- breakdown pokazuje wszystkie aktywne efekty,
- wynik jest deterministyczny.

### Faza 9 — Anomalie rundy

Cel:
Dodać wspólne eventy bez komplikowania rulesetu.

Zadania:

- wygeneruj Anomalię przed pytaniem 4,
- wygeneruj Anomalię przed pytaniem 8,
- pokaż banner Anomalii wszystkim graczom,
- zastosuj efekt tylko do wskazanego pytania,
- dodaj Anomalię do breakdownu.

Kryteria akceptacji:

- wszyscy gracze widzą tę samą Anomalię,
- Anomalia działa tylko w swoim pytaniu,
- efekt jest liczbowy i widoczny.

### Faza 10 — Ranked i rating

Cel:
Dodać ranked bez zmiany zasad gry.

Zadania:

- `room.mode = ranked`,
- dodaj `ratings`,
- po zakończeniu ranked aktualizuj rating,
- na start użyj prostego pairwise Elo dla FFA,
- pokaż rating na profilu gracza,
- casual nie zmienia ratingu.

Prosty pairwise Elo:

- każdy gracz jest porównywany z każdym innym,
- wyższe miejsce = win w parze,
- takie samo miejsce = draw,
- K = 24 dla FFA,
- rating startowy = 1000.

Kryteria akceptacji:

- casual nie zmienia ratingu,
- ranked zmienia rating,
- zasady meczu są identyczne,
- ranking jest aktualizowany tylko raz na mecz.

### Faza 11 — Matchmaking ranked

Cel:
Dodać wyszukiwanie graczy.

Zadania:

- tabela `matchmaking_queue`,
- ekran „Szukaj gry”,
- dobieranie graczy o podobnym ratingu,
- start z 2-player ranked duel lub 4-player arena,
- rozszerzanie zakresu ratingu co 15 sekund,
- anulowanie kolejki,
- timeout.

Kryteria akceptacji:

- gracz może wejść do kolejki,
- gracz może wyjść z kolejki,
- gracze o podobnym ratingu trafiają do pokoju,
- pokój startuje z tym samym rulesetem.

### Faza 12 — Deploy

Cel:
Wypuścić PWA.

Zadania:

- skonfiguruj Cloudflare Pages,
- build command: `pnpm build`,
- output directory: `dist`,
- dodaj env vars,
- podłącz Supabase hosted,
- uruchom migracje,
- seed static content,
- sprawdź HTTPS,
- sprawdź manifest PWA,
- sprawdź mobile.

Kryteria akceptacji:

- aplikacja działa z publicznego linku,
- można stworzyć pokój,
- można dołączyć z telefonu,
- można rozegrać pełny Test 2 graczy,
- build produkcyjny nie loguje sekretów.

---

## 17. Testy

### Unit tests

- scoring bazowy,
- speed bonus,
- wrong/no answer,
- każdy Profil,
- każda Modyfikacja,
- każda Anomalia,
- seedowane losowanie,
- stage draftu.

### Integration tests

- create room,
- join room,
- select profile,
- submit answer,
- draft modification,
- finish game.

### E2E

Minimum:

- browser A tworzy pokój,
- browser B dołącza,
- obaj wybierają kategorię,
- obaj wybierają Profil,
- obaj odpowiadają na 12 pytań,
- pojawia się draft po 3/6/9,
- pojawia się końcowa tabela.

---

## 18. Edge cases

Obsłuż:

- gracz odświeża stronę,
- gracz traci połączenie,
- gracz wraca do pokoju,
- host wychodzi z lobby,
- ktoś nie wybiera Profilu,
- ktoś nie wybiera Modyfikacji,
- ktoś nie odpowiada na pytanie,
- wszyscy odpowiedzieli przed czasem,
- kończy się czas pytania,
- brakuje pytań w wybranej kategorii,
- dwóch graczy ma ten sam Profil,
- gracz próbuje wysłać odpowiedź dwa razy,
- gracz próbuje wysłać odpowiedź po czasie,
- gracz próbuje wybrać Modyfikację spoza swojej trójki.

Domyślne timeouty:

- category vote: 20 sekund,
- profile draft: 30 sekund,
- modification draft: 25 sekund,
- question: 15 sekund bazowo,
- results screen: 6 sekund.

Jeśli gracz nie wybierze Profilu albo Modyfikacji w czasie, system wybiera losowo jedną z dostępnych opcji.

---

## 19. Admin i pytania

Na MVP nie buduj pełnego CMS.

Zrób prosty import pytań przez seed/CSV.

Docelowy CSV:

```text
type,category,difficulty,question_text,option_a,option_b,option_c,option_d,correct_answer,tolerance,explanation,is_ranked_safe
```

Dla numeric:

```text
numeric,Nauka,medium,Ile planet jest w Układzie Słonecznym?,,,,,8,0,Po degradacji Plutona jest 8 planet,true
```

Dla true_false:

```text
true_false,Historia,easy,Bitwa pod Grunwaldem odbyła się w 1410 roku.,Prawda,Fałsz,,,A,,,
```

W ranked używaj tylko `is_ranked_safe = true`.

---

## 20. Zasady pracy dla Claude Code

Pracuj etapami. Nie próbuj budować wszystkiego naraz.

Po każdej fazie:

- uruchom `pnpm test`,
- uruchom `pnpm build`,
- popraw błędy TypeScript,
- upewnij się, że UI działa na mobile,
- zaktualizuj README,
- zostaw aplikację w stanie grywalnym.

Zakazy:

- nie dodawaj monetyzacji,
- nie dodawaj sklepu,
- nie dodawaj specjalnych trybów,
- nie dodawaj mini-ekonomii,
- nie zmieniaj rulesetu ranked vs casual,
- nie wprowadzaj ukrytych efektów kart,
- nie używaj niekonkretnych opisów efektów,
- nie używaj `Math.random()` w logice gry,
- nie wkładaj sekretów do frontendu,
- nie licz wyniku wyłącznie po stronie klienta.

---

## 21. Minimalny definition of done prototypu

Prototyp jest gotowy, gdy:

- użytkownik może wejść w link PWA,
- aplikacja loguje go anonimowo,
- użytkownik może ustawić nick,
- może stworzyć Komorę testową,
- drugi gracz może dołączyć kodem,
- obaj mogą wybrać kategorię,
- obaj dostają 3 Profile i wybierają 1,
- rozgrywają 12 wspólnych pytań,
- po pytaniach 3, 6 i 9 wybierają Modyfikację,
- Anomalie pojawiają się przed pytaniem 4 i 8,
- wynik jest liczony po stronie backendu,
- po każdym pytaniu widać breakdown,
- po meczu widać końcową tabelę,
- casual i ranked mają identyczny ruleset,
- ranked aktualizuje rating,
- aplikacja działa na telefonie.

---

## 22. Pierwszy prompt roboczy do Claude Code

Wklej do Claude Code:

```text
Budujemy od zera projekt ANOMALIA: Quiz Arena.

To ma być mobile-first PWA w Vite + React + TypeScript z Supabase jako backendem MVP. Gra to realtime multiplayer quiz dla 2–8 graczy. Każdy mecz to Test w klimacie Instytutu Anomalii. Gracze odpowiadają na te same 12 pytań, wybierają jeden Profil z trzech losowych opcji, a po pytaniach 3, 6 i 9 wybierają Modyfikację z trzech losowych opcji. Casual i ranked mają identyczne zasady; ranked różni się tylko zapisem ratingu. Nie implementuj monetyzacji, mini-ekonomii, komentarzy po pytaniach ani specjalnych trybów.

Najważniejsze: wszystkie karty Profili i Modyfikacji muszą mieć konkretne liczbowe efekty. Nie wolno używać opisów typu „lekko”, „trochę”, „znacznie”.

Zacznij od Fazy 1:
- utwórz projekt Vite React TypeScript,
- skonfiguruj Tailwind,
- skonfiguruj routing,
- skonfiguruj PWA manifest,
- dodaj podstawowy design system,
- dodaj ekran startowy ANOMALIA: Quiz Arena,
- dodaj Vitest,
- dodaj README,
- dodaj .env.example,
- upewnij się, że pnpm build i pnpm test przechodzą.

Nie przechodź do kolejnej fazy, dopóki Faza 1 nie jest kompletna.
```
