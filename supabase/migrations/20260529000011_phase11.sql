-- Phase 11: Matchmaking ranked
-- matchmaking_queue table, RLS, Realtime, and 4 RPCs:
--   _try_match_players (internal)
--   join_matchmaking_queue (public)
--   leave_matchmaking_queue (public)
--   tick_matchmaking (public, called by client every 15 s)

-- ─────────────────────────────────────────────────────────────────────────────
-- Table
-- ─────────────────────────────────────────────────────────────────────────────
create table matchmaking_queue (
  id                uuid        primary key default gen_random_uuid(),
  user_id           uuid        not null references auth.users(id) on delete cascade,
  display_name      text        not null,
  rating            int         not null default 1000,
  mode              text        not null check (mode in ('duel', 'arena')),
  joined_at         timestamptz not null default now(),
  status            text        not null default 'searching'
                    check (status in ('searching', 'matched', 'cancelled', 'timeout')),
  matched_room_id   uuid        references rooms(id),
  matched_room_code text,
  unique (user_id)
);

-- ─────────────────────────────────────────────────────────────────────────────
-- RLS
-- ─────────────────────────────────────────────────────────────────────────────
alter table matchmaking_queue enable row level security;

create policy "matchmaking_queue: own row"
  on matchmaking_queue for all
  using (user_id = auth.uid());

-- ─────────────────────────────────────────────────────────────────────────────
-- Realtime
-- ─────────────────────────────────────────────────────────────────────────────
alter publication supabase_realtime add table matchmaking_queue;

-- ─────────────────────────────────────────────────────────────────────────────
-- Internal: _try_match_players(p_mode)
-- Picks the oldest searching player as seed, computes their search range,
-- collects enough players within that range, and creates a ranked room.
-- Advisory lock prevents concurrent races between two simultaneous callers.
-- Search range: ±100 base, +±50 every 15 s, capped at ±10 000.
-- ─────────────────────────────────────────────────────────────────────────────
create or replace function _try_match_players(p_mode text)
returns void
language plpgsql
security definer
as $$
declare
  v_needed       int;
  v_seed_uid     uuid;
  v_seed_rating  int;
  v_seed_joined  timestamptz;
  v_range        int;
  v_match_ids    uuid[];
  v_room_id      uuid;
  v_room_code    text;
begin
  v_needed := case when p_mode = 'duel' then 2 else 4 end;

  perform pg_advisory_xact_lock(hashtext('matchmaking_' || p_mode));

  -- Pick oldest searching player as seed
  select user_id, rating, joined_at
  into v_seed_uid, v_seed_rating, v_seed_joined
  from matchmaking_queue
  where status = 'searching' and mode = p_mode
  order by joined_at
  limit 1;

  if not found then return; end if;

  -- Seed's search range grows ±50 per 15 s, starting at ±100
  v_range := least(
    100 + (floor(extract(epoch from (now() - v_seed_joined)) / 15)::int * 50),
    10000
  );

  -- Collect v_needed players (including seed) ordered by join time
  select array_agg(user_id order by joined_at)
  into v_match_ids
  from (
    select user_id
    from matchmaking_queue
    where status = 'searching'
      and mode = p_mode
      and abs(rating - v_seed_rating) <= v_range
    order by joined_at
    limit v_needed
  ) sub;

  if array_length(v_match_ids, 1) < v_needed then return; end if;

  -- Create ranked room (first player becomes host)
  v_room_code := generate_room_code();
  insert into rooms (code, mode, host_user_id, seed, max_players)
  values (v_room_code, 'ranked'::room_mode, v_match_ids[1], gen_random_uuid()::text, v_needed)
  returning id into v_room_id;

  -- Add matched players with slots ordered by join time
  insert into room_players (room_id, user_id, display_name, slot)
  select v_room_id, mq.user_id, mq.display_name,
         row_number() over (order by mq.joined_at)::int
  from matchmaking_queue mq
  where mq.user_id = any(v_match_ids);

  -- Mark matched (triggers Realtime UPDATE for each player)
  update matchmaking_queue
  set status            = 'matched',
      matched_room_id   = v_room_id,
      matched_room_code = v_room_code
  where user_id = any(v_match_ids);
end;
$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- Public: join_matchmaking_queue(p_mode) → {status, room_code}
-- Upserts the calling player into the queue (resets to searching unless
-- already matched), then immediately attempts to form a match.
-- ─────────────────────────────────────────────────────────────────────────────
create or replace function join_matchmaking_queue(p_mode text)
returns json
language plpgsql
security definer
as $$
declare
  v_display_name text;
  v_rating       int;
  v_result       matchmaking_queue%rowtype;
begin
  if auth.uid() is null then raise exception 'UNAUTHORIZED'; end if;
  if p_mode not in ('duel', 'arena') then raise exception 'INVALID_MODE'; end if;

  select display_name into v_display_name
  from player_profiles where user_id = auth.uid();
  v_display_name := coalesce(v_display_name, 'Uczestnik');

  select rating into v_rating
  from ratings where user_id = auth.uid();
  v_rating := coalesce(v_rating, 1000);

  -- Upsert: preserve matched state, reset everything else to searching
  insert into matchmaking_queue (user_id, display_name, rating, mode)
  values (auth.uid(), v_display_name, v_rating, p_mode)
  on conflict (user_id) do update
    set display_name      = case when matchmaking_queue.status = 'matched'
                              then matchmaking_queue.display_name else excluded.display_name end,
        rating            = case when matchmaking_queue.status = 'matched'
                              then matchmaking_queue.rating else excluded.rating end,
        mode              = case when matchmaking_queue.status = 'matched'
                              then matchmaking_queue.mode else excluded.mode end,
        joined_at         = case when matchmaking_queue.status = 'matched'
                              then matchmaking_queue.joined_at else now() end,
        status            = case when matchmaking_queue.status = 'matched'
                              then matchmaking_queue.status else 'searching' end,
        matched_room_id   = case when matchmaking_queue.status = 'matched'
                              then matchmaking_queue.matched_room_id else null end,
        matched_room_code = case when matchmaking_queue.status = 'matched'
                              then matchmaking_queue.matched_room_code else null end;

  select * into v_result from matchmaking_queue where user_id = auth.uid();

  -- Already matched — return immediately without re-matching
  if v_result.status = 'matched' then
    return json_build_object('status', 'matched', 'room_code', v_result.matched_room_code);
  end if;

  perform _try_match_players(p_mode);

  select * into v_result from matchmaking_queue where user_id = auth.uid();
  return json_build_object('status', v_result.status, 'room_code', v_result.matched_room_code);
end;
$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- Public: leave_matchmaking_queue() → void
-- ─────────────────────────────────────────────────────────────────────────────
create or replace function leave_matchmaking_queue()
returns void
language plpgsql
security definer
as $$
begin
  if auth.uid() is null then raise exception 'UNAUTHORIZED'; end if;
  update matchmaking_queue
  set status = 'cancelled'
  where user_id = auth.uid() and status = 'searching';
end;
$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- Public: tick_matchmaking(p_mode) → void
-- Called by the client every 15 s while searching.
-- Times out entries older than 120 s, then re-tries matching.
-- Also cleans up stale cancelled/timeout entries older than 1 hour.
-- ─────────────────────────────────────────────────────────────────────────────
create or replace function tick_matchmaking(p_mode text)
returns void
language plpgsql
security definer
as $$
begin
  if auth.uid() is null then raise exception 'UNAUTHORIZED'; end if;
  if p_mode not in ('duel', 'arena') then raise exception 'INVALID_MODE'; end if;

  -- Timeout entries that have been searching for more than 120 s
  update matchmaking_queue
  set status = 'timeout'
  where status = 'searching'
    and mode = p_mode
    and joined_at < now() - interval '120 seconds';

  -- Prune old non-searching rows
  delete from matchmaking_queue
  where status in ('cancelled', 'timeout')
    and joined_at < now() - interval '1 hour';

  perform _try_match_players(p_mode);
end;
$$;
