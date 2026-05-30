-- Phase 10: Ranked i rating
-- ratings table + RLS already exist in init.sql / rls.sql.
-- This migration adds: Realtime, ratings_computed_at on rooms, and the
-- update_ratings_after_game RPC (pairwise Elo FFA, K=24, starting rating=1000).

-- ─────────────────────────────────────────────────────────────────────────────
-- Realtime for lobby rating display
-- ─────────────────────────────────────────────────────────────────────────────
alter publication supabase_realtime add table ratings;

-- ─────────────────────────────────────────────────────────────────────────────
-- Track whether ratings have been computed for a room (idempotency guard)
-- ─────────────────────────────────────────────────────────────────────────────
alter table rooms add column if not exists ratings_computed_at timestamptz;

-- ─────────────────────────────────────────────────────────────────────────────
-- update_ratings_after_game(p_room_id)
-- Called by any room member from ScoreboardPage.
-- Noop for casual games, already-computed games, or unfinished games.
-- Pairwise Elo FFA: every player is compared against every other player.
--   K = 24, starting rating = 1000.
--   outcome per pair: 1.0 (higher score), 0.5 (tie), 0.0 (lower score).
-- Advisory lock prevents two simultaneous callers from both running.
-- ─────────────────────────────────────────────────────────────────────────────
create or replace function update_ratings_after_game(p_room_id uuid)
returns void
language plpgsql
security definer
as $$
begin
  if auth.uid() is null then raise exception 'UNAUTHORIZED'; end if;

  -- Only ranked + finished rooms
  if not exists (
    select 1 from rooms
    where id = p_room_id and mode = 'ranked' and status = 'finished'
  ) then return; end if;

  -- Fast idempotency check (before acquiring lock)
  if (select ratings_computed_at from rooms where id = p_room_id) is not null then
    return;
  end if;

  -- Membership check
  if not exists (
    select 1 from room_players
    where room_id = p_room_id and user_id = auth.uid() and left_at is null
  ) then raise exception 'NOT_IN_ROOM'; end if;

  -- Advisory lock — prevents two concurrent callers from both computing
  perform pg_advisory_xact_lock(abs(hashtext(p_room_id::text)));

  -- Re-check after acquiring lock
  if (select ratings_computed_at from rooms where id = p_room_id) is not null then
    return;
  end if;

  -- Pairwise Elo update (K=24)
  with
  standings as (
    select user_id, score
    from room_players
    where room_id = p_room_id and left_at is null
  ),
  curr as (
    select s.user_id, s.score,
           coalesce(r.rating, 1000) as rating
    from standings s
    left join ratings r on r.user_id = s.user_id
  ),
  pairs as (
    -- Each unique pair (a.user_id < b.user_id) compared once
    select
      a.user_id as uid_a, a.rating::float8 as r_a, a.score as s_a,
      b.user_id as uid_b, b.rating::float8 as r_b, b.score as s_b
    from curr a
    join curr b on a.user_id < b.user_id
  ),
  pair_outcomes as (
    select
      uid_a, uid_b, r_a, r_b,
      case when s_a > s_b then 1.0
           when s_a = s_b then 0.5
           else 0.0
      end as outcome_a
    from pairs
  ),
  -- Delta contribution for player A in each pair
  deltas_a as (
    select uid_a as user_id,
      24.0 * (outcome_a - 1.0 / (1.0 + power(10.0, (r_b - r_a) / 400.0))) as delta
    from pair_outcomes
  ),
  -- Delta contribution for player B in each pair
  deltas_b as (
    select uid_b as user_id,
      24.0 * ((1.0 - outcome_a) - 1.0 / (1.0 + power(10.0, (r_a - r_b) / 400.0))) as delta
    from pair_outcomes
  ),
  all_deltas as (
    select * from deltas_a
    union all
    select * from deltas_b
  ),
  agg as (
    select user_id, sum(delta) as total_delta
    from all_deltas
    group by user_id
  ),
  top_score as (
    select max(score) as value from standings
  )
  insert into ratings (user_id, rating, games_played, wins, updated_at)
  select
    a.user_id,
    greatest(0, coalesce(r.rating, 1000) + round(a.total_delta)::int),
    coalesce(r.games_played, 0) + 1,
    coalesce(r.wins, 0) + case when s.score = t.value then 1 else 0 end,
    now()
  from agg a
  join standings s on s.user_id = a.user_id
  cross join top_score t
  left join ratings r on r.user_id = a.user_id
  on conflict (user_id) do update
  set
    rating       = excluded.rating,
    games_played = excluded.games_played,
    wins         = excluded.wins,
    updated_at   = now();

  update rooms set ratings_computed_at = now() where id = p_room_id;
end;
$$;
