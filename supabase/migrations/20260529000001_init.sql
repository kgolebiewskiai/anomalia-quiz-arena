-- Enum types
create type question_type as enum ('single_choice', 'true_false', 'numeric', 'order');
create type room_mode as enum ('casual', 'ranked');
create type room_status as enum (
  'lobby',
  'category_vote',
  'profile_draft',
  'question',
  'modification_draft',
  'results',
  'finished'
);

-- Static content tables
create table profiles (
  id                  text primary key,
  name                text not null,
  style               text not null,
  passive_description text not null,
  active_description  text not null,
  flavor              text not null,
  config              jsonb not null default '{}',
  is_enabled          boolean not null default true,
  created_at          timestamptz not null default now()
);

create table modifications (
  id                   text primary key,
  name                 text not null,
  type                 text not null,
  effect_description   text not null,
  duration_description text not null,
  flavor               text not null,
  config               jsonb not null default '{}',
  is_enabled           boolean not null default true,
  created_at           timestamptz not null default now()
);

create table anomalies (
  id               text primary key,
  name             text not null,
  effect_description text not null,
  config           jsonb not null default '{}',
  is_enabled       boolean not null default true
);

create table categories (
  id         uuid primary key default gen_random_uuid(),
  name       text not null unique,
  is_enabled boolean not null default true
);

create table questions (
  id              uuid primary key default gen_random_uuid(),
  type            question_type not null,
  category_id     uuid references categories(id),
  difficulty      text not null check (difficulty in ('easy', 'medium', 'hard')),
  question_text   text not null,
  options         jsonb,
  correct_answer  jsonb not null,
  tolerance       numeric,
  explanation     text,
  is_ranked_safe  boolean not null default false,
  is_enabled      boolean not null default true,
  created_at      timestamptz not null default now()
);

-- Game tables
create table player_profiles (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid references auth.users(id) not null unique,
  display_name text not null,
  avatar_url   text,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create table rooms (
  id                       uuid primary key default gen_random_uuid(),
  code                     text not null unique,
  mode                     room_mode not null,
  status                   room_status not null default 'lobby',
  host_user_id             uuid references auth.users(id) not null,
  seed                     text not null,
  max_players              int not null default 8 check (max_players between 2 and 8),
  current_question_index   int not null default 0,
  current_phase_started_at timestamptz,
  current_phase_duration_ms int,
  active_anomaly_id        text references anomalies(id),
  settings                 jsonb not null default '{}',
  created_at               timestamptz not null default now(),
  started_at               timestamptz,
  finished_at              timestamptz
);

create table room_players (
  id                  uuid primary key default gen_random_uuid(),
  room_id             uuid references rooms(id) on delete cascade not null,
  user_id             uuid references auth.users(id) not null,
  display_name        text not null,
  slot                int not null,
  selected_profile_id text references profiles(id),
  score               int not null default 0,
  streak              int not null default 0,
  is_connected        boolean not null default true,
  is_ready            boolean not null default false,
  joined_at           timestamptz not null default now(),
  left_at             timestamptz,
  unique(room_id, user_id),
  unique(room_id, slot)
);

create table room_category_votes (
  id          uuid primary key default gen_random_uuid(),
  room_id     uuid references rooms(id) on delete cascade not null,
  user_id     uuid references auth.users(id) not null,
  category_id uuid references categories(id) not null,
  created_at  timestamptz not null default now(),
  unique(room_id, user_id)
);

create table room_questions (
  id             uuid primary key default gen_random_uuid(),
  room_id        uuid references rooms(id) on delete cascade not null,
  question_id    uuid references questions(id) not null,
  question_index int not null check (question_index between 1 and 12),
  anomaly_id     text references anomalies(id),
  created_at     timestamptz not null default now(),
  unique(room_id, question_index)
);

create table room_profile_options (
  id          uuid primary key default gen_random_uuid(),
  room_id     uuid references rooms(id) on delete cascade not null,
  user_id     uuid references auth.users(id) not null,
  profile_ids text[] not null,
  created_at  timestamptz not null default now(),
  unique(room_id, user_id)
);

create table room_modification_options (
  id                       uuid primary key default gen_random_uuid(),
  room_id                  uuid references rooms(id) on delete cascade not null,
  user_id                  uuid references auth.users(id) not null,
  draft_stage              int not null check (draft_stage in (3, 6, 9)),
  modification_ids         text[] not null,
  selected_modification_id text references modifications(id),
  created_at               timestamptz not null default now(),
  selected_at              timestamptz,
  unique(room_id, user_id, draft_stage)
);

create table player_modifications (
  id              uuid primary key default gen_random_uuid(),
  room_id         uuid references rooms(id) on delete cascade not null,
  user_id         uuid references auth.users(id) not null,
  modification_id text references modifications(id) not null,
  draft_stage     int not null check (draft_stage in (3, 6, 9)),
  remaining_questions int,
  uses_remaining  int,
  state           jsonb not null default '{}',
  created_at      timestamptz not null default now()
);

create table answers (
  id             uuid primary key default gen_random_uuid(),
  room_id        uuid references rooms(id) on delete cascade not null,
  user_id        uuid references auth.users(id) not null,
  question_index int not null,
  question_id    uuid references questions(id) not null,
  answer         jsonb not null,
  is_correct     boolean not null,
  answered_at    timestamptz not null default now(),
  response_ms    int not null,
  base_points    int not null,
  speed_bonus    int not null,
  flat_bonus     int not null default 0,
  multiplier     numeric not null default 1,
  penalty        int not null default 0,
  total_points   int not null,
  breakdown      jsonb not null,
  created_at     timestamptz not null default now(),
  unique(room_id, user_id, question_index)
);

create table ratings (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid references auth.users(id) not null unique,
  rating       int not null default 1000,
  games_played int not null default 0,
  wins         int not null default 0,
  updated_at   timestamptz not null default now()
);

-- Updated_at trigger for player_profiles
create or replace function update_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger player_profiles_updated_at
  before update on player_profiles
  for each row execute function update_updated_at();
