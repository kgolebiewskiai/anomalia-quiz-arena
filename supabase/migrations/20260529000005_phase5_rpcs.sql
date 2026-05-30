-- Enable Realtime on phase-5 tables
alter publication supabase_realtime add table room_category_votes;
alter publication supabase_realtime add table room_profile_options;

-- Update RLS on room_category_votes:
-- Allow room members to read all votes (for vote-count display),
-- but only insert/update their own.
drop policy "room_category_votes: own row" on room_category_votes;

create policy "room_category_votes: read same room"
  on room_category_votes for select
  using (
    room_id in (
      select room_id from room_players where user_id = auth.uid() and left_at is null
    )
  );

create policy "room_category_votes: insert own"
  on room_category_votes for insert
  with check (user_id = auth.uid());

create policy "room_category_votes: update own"
  on room_category_votes for update
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- ─────────────────────────────────────────────────────────────────────────────
-- start_room(p_room_id)
-- Host only. Transitions lobby → category_vote, sets 20 s phase timer.
-- ─────────────────────────────────────────────────────────────────────────────
create or replace function start_room(p_room_id uuid)
returns void
language plpgsql
security definer
as $$
declare
  v_status     room_status;
  v_host_id    uuid;
  v_active_cnt int;
begin
  if auth.uid() is null then
    raise exception 'UNAUTHORIZED';
  end if;

  select status, host_user_id
  into v_status, v_host_id
  from rooms
  where id = p_room_id;

  if not found then
    raise exception 'ROOM_NOT_FOUND';
  end if;

  if v_host_id <> auth.uid() then
    raise exception 'NOT_HOST';
  end if;

  if v_status <> 'lobby' then
    raise exception 'WRONG_PHASE';
  end if;

  select count(*) into v_active_cnt
  from room_players
  where room_id = p_room_id and left_at is null;

  if v_active_cnt < 2 then
    raise exception 'NOT_ENOUGH_PLAYERS';
  end if;

  update rooms
  set
    status                   = 'category_vote',
    started_at               = now(),
    current_phase_started_at = now(),
    current_phase_duration_ms = 20000
  where id = p_room_id;
end;
$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- _execute_profile_draft(p_room_id)
-- Internal helper (SECURITY DEFINER) — generates 3-profile options per player
-- using a deterministic Fisher-Yates shuffle seeded by room.seed:profile:uid,
-- then transitions the room to profile_draft.
-- Idempotent: does nothing if room is already past category_vote.
-- ─────────────────────────────────────────────────────────────────────────────
create or replace function _execute_profile_draft(p_room_id uuid)
returns void
language plpgsql
security definer
as $$
declare
  v_room        record;
  v_player      record;
  v_profile_ids text[];
  v_n           int;
  v_seed_str    text;
  v_seed_float  float8;
  v_shuffled    text[];
  v_i           int;
  v_j           int;
  v_tmp         text;
begin
  select * into v_room from rooms where id = p_room_id;

  -- Idempotent guard
  if v_room.status <> 'category_vote' then
    return;
  end if;

  -- Sorted list of enabled profile IDs (deterministic base ordering)
  select array_agg(id order by id) into v_profile_ids
  from profiles
  where is_enabled = true;

  v_n := array_length(v_profile_ids, 1);

  for v_player in
    select user_id, slot
    from room_players
    where room_id = p_room_id and left_at is null
    order by slot
  loop
    -- Skip if options were already generated (concurrent call guard)
    if exists (
      select 1 from room_profile_options
      where room_id = p_room_id and user_id = v_player.user_id
    ) then
      continue;
    end if;

    -- Deterministic seed: float in (-1, 1) derived from hashtext
    v_seed_str   := v_room.seed || ':profile:' || v_player.user_id::text;
    v_seed_float := hashtext(v_seed_str)::float8 / 2147483648.0;

    -- Fisher-Yates shuffle
    v_shuffled := v_profile_ids;
    perform setseed(v_seed_float);

    for v_i in reverse v_n..2 loop
      v_j               := floor(random() * v_i)::int + 1;
      v_tmp             := v_shuffled[v_i];
      v_shuffled[v_i]   := v_shuffled[v_j];
      v_shuffled[v_j]   := v_tmp;
    end loop;

    insert into room_profile_options (room_id, user_id, profile_ids)
    values (p_room_id, v_player.user_id, v_shuffled[1:3]);
  end loop;

  update rooms
  set
    status                    = 'profile_draft',
    current_phase_started_at  = now(),
    current_phase_duration_ms = 30000
  where id = p_room_id;
end;
$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- submit_category_vote(p_room_id, p_category_id)
-- Any room member votes for one category. Upserts (can change vote before
-- all players have voted). When the last vote arrives the phase auto-advances.
-- ─────────────────────────────────────────────────────────────────────────────
create or replace function submit_category_vote(p_room_id uuid, p_category_id uuid)
returns void
language plpgsql
security definer
as $$
declare
  v_status      room_status;
  v_active_cnt  int;
  v_vote_cnt    int;
begin
  if auth.uid() is null then
    raise exception 'UNAUTHORIZED';
  end if;

  select status into v_status from rooms where id = p_room_id;
  if not found then raise exception 'ROOM_NOT_FOUND'; end if;
  if v_status <> 'category_vote' then raise exception 'WRONG_PHASE'; end if;

  if not exists (
    select 1 from room_players
    where room_id = p_room_id and user_id = auth.uid() and left_at is null
  ) then
    raise exception 'NOT_IN_ROOM';
  end if;

  if not exists (
    select 1 from categories where id = p_category_id and is_enabled = true
  ) then
    raise exception 'INVALID_CATEGORY';
  end if;

  insert into room_category_votes (room_id, user_id, category_id)
  values (p_room_id, auth.uid(), p_category_id)
  on conflict (room_id, user_id) do update set category_id = excluded.category_id;

  -- If all active players have voted → auto-advance to profile_draft
  select count(*) into v_active_cnt
  from room_players where room_id = p_room_id and left_at is null;

  select count(*) into v_vote_cnt
  from room_category_votes where room_id = p_room_id;

  if v_vote_cnt >= v_active_cnt then
    perform _execute_profile_draft(p_room_id);
  end if;
end;
$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- prepare_profile_draft(p_room_id)
-- Callable by any room member as a timeout fallback.
-- Forces the transition to profile_draft regardless of vote count.
-- Idempotent: does nothing if already past category_vote.
-- ─────────────────────────────────────────────────────────────────────────────
create or replace function prepare_profile_draft(p_room_id uuid)
returns void
language plpgsql
security definer
as $$
declare
  v_status room_status;
begin
  if auth.uid() is null then
    raise exception 'UNAUTHORIZED';
  end if;

  select status into v_status from rooms where id = p_room_id;
  if not found then raise exception 'ROOM_NOT_FOUND'; end if;

  if v_status <> 'category_vote' then
    return;
  end if;

  if not exists (
    select 1 from room_players
    where room_id = p_room_id and user_id = auth.uid() and left_at is null
  ) then
    raise exception 'NOT_IN_ROOM';
  end if;

  perform _execute_profile_draft(p_room_id);
end;
$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- select_profile(p_room_id, p_profile_id)
-- Player selects one of their 3 generated profile options.
-- ─────────────────────────────────────────────────────────────────────────────
create or replace function select_profile(p_room_id uuid, p_profile_id text)
returns void
language plpgsql
security definer
as $$
declare
  v_status  room_status;
  v_options record;
begin
  if auth.uid() is null then
    raise exception 'UNAUTHORIZED';
  end if;

  select status into v_status from rooms where id = p_room_id;
  if not found then raise exception 'ROOM_NOT_FOUND'; end if;
  if v_status <> 'profile_draft' then raise exception 'WRONG_PHASE'; end if;

  if not exists (
    select 1 from room_players
    where room_id = p_room_id and user_id = auth.uid() and left_at is null
  ) then
    raise exception 'NOT_IN_ROOM';
  end if;

  select * into v_options
  from room_profile_options
  where room_id = p_room_id and user_id = auth.uid();

  if not found then
    raise exception 'NO_OPTIONS';
  end if;

  if p_profile_id != any(v_options.profile_ids) then
    raise exception 'INVALID_PROFILE';
  end if;

  update room_players
  set selected_profile_id = p_profile_id
  where room_id = p_room_id and user_id = auth.uid();
end;
$$;
