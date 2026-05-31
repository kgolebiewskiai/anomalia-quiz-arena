-- Fix: timer-fallback RPCs (prepare_profile_draft, prepare_questions,
-- prepare_modification_draft) were callable at any time — including immediately
-- on page load before the countdown even started (the frontend useCountdown hook
-- returns 0 as its initial state before room data arrives).
-- Adding a server-side guard: if the phase timer has not yet elapsed, return
-- silently instead of forcing the transition.

-- ─────────────────────────────────────────────────────────────────────────────
-- prepare_profile_draft — guard: don't advance before category_vote timer expires
-- ─────────────────────────────────────────────────────────────────────────────
create or replace function prepare_profile_draft(p_room_id uuid)
returns void
language plpgsql
security definer
as $$
declare
  v_room record;
begin
  if auth.uid() is null then raise exception 'UNAUTHORIZED'; end if;

  select * into v_room from rooms where id = p_room_id;
  if not found then raise exception 'ROOM_NOT_FOUND'; end if;

  if v_room.status <> 'category_vote' then return; end if;

  if not exists (
    select 1 from room_players
    where room_id = p_room_id and user_id = auth.uid() and left_at is null
  ) then raise exception 'NOT_IN_ROOM'; end if;

  -- Only force-advance once the phase timer has actually elapsed
  if v_room.current_phase_started_at is not null
     and v_room.current_phase_duration_ms is not null
     and extract(epoch from now() - v_room.current_phase_started_at) * 1000
         < v_room.current_phase_duration_ms then
    return;
  end if;

  perform _execute_profile_draft(p_room_id);
end;
$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- prepare_questions — guard: don't advance before profile_draft timer expires
-- ─────────────────────────────────────────────────────────────────────────────
create or replace function prepare_questions(p_room_id uuid)
returns void
language plpgsql
security definer
as $$
declare
  v_room        record;
  v_player      record;
  v_options     record;
  v_random_idx  int;
  v_random_prof text;
begin
  if auth.uid() is null then raise exception 'UNAUTHORIZED'; end if;

  select * into v_room from rooms where id = p_room_id;
  if not found then raise exception 'ROOM_NOT_FOUND'; end if;
  if v_room.status <> 'profile_draft' then return; end if;

  if not exists (
    select 1 from room_players
    where room_id = p_room_id and user_id = auth.uid() and left_at is null
  ) then raise exception 'NOT_IN_ROOM'; end if;

  -- Only force-advance once the phase timer has actually elapsed
  if v_room.current_phase_started_at is not null
     and v_room.current_phase_duration_ms is not null
     and extract(epoch from now() - v_room.current_phase_started_at) * 1000
         < v_room.current_phase_duration_ms then
    return;
  end if;

  -- Assign random profile to any player who hasn't chosen yet
  for v_player in
    select rp.user_id, rp.room_id
    from room_players rp
    where rp.room_id = p_room_id and rp.left_at is null
      and rp.selected_profile_id is null
  loop
    select * into v_options
    from room_profile_options
    where room_id = v_player.room_id and user_id = v_player.user_id;

    if found then
      v_random_idx  := floor(random() * array_length(v_options.profile_ids, 1))::int + 1;
      v_random_prof := v_options.profile_ids[v_random_idx];

      update room_players
      set selected_profile_id = v_random_prof
      where room_id = p_room_id and user_id = v_player.user_id;
    end if;
  end loop;

  perform _execute_prepare_questions(p_room_id);
end;
$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- prepare_modification_draft — guard: don't advance before modification_draft timer expires
-- (redefined here over migration 16 to add the timer guard)
-- ─────────────────────────────────────────────────────────────────────────────
create or replace function prepare_modification_draft(p_room_id uuid, p_draft_stage int)
returns void
language plpgsql
security definer
as $$
declare
  v_status          room_status;
  v_room_seed       text;
  v_curr_idx        int;
  v_phase_started   timestamptz;
  v_phase_duration  int;
  v_player          record;
  v_opts            record;
  v_idx             int;
  v_next_anomaly_id text;
begin
  if auth.uid() is null then raise exception 'UNAUTHORIZED'; end if;

  select status, seed, current_question_index, current_phase_started_at, current_phase_duration_ms
  into v_status, v_room_seed, v_curr_idx, v_phase_started, v_phase_duration
  from rooms where id = p_room_id;
  if not found then raise exception 'ROOM_NOT_FOUND'; end if;
  if v_status <> 'modification_draft' then return; end if;

  if not exists (
    select 1 from room_players
    where room_id = p_room_id and user_id = auth.uid() and left_at is null
  ) then raise exception 'NOT_IN_ROOM'; end if;

  -- Only force-advance once the phase timer has actually elapsed
  if v_phase_started is not null
     and v_phase_duration is not null
     and extract(epoch from now() - v_phase_started) * 1000 < v_phase_duration then
    return;
  end if;

  for v_player in
    select rp.user_id
    from room_players rp
    where rp.room_id = p_room_id and rp.left_at is null
  loop
    select * into v_opts
    from room_modification_options
    where room_id = p_room_id
      and user_id = v_player.user_id
      and draft_stage = p_draft_stage;

    if found and v_opts.selected_modification_id is null then
      v_idx := floor(random() * array_length(v_opts.modification_ids, 1))::int + 1;

      update room_modification_options
      set selected_modification_id = modification_ids[v_idx],
          selected_at = now()
      where room_id = p_room_id
        and user_id = v_player.user_id
        and draft_stage = p_draft_stage;

      if not exists (
        select 1 from player_modifications
        where room_id = p_room_id
          and user_id = v_player.user_id
          and draft_stage = p_draft_stage
      ) then
        insert into player_modifications (room_id, user_id, modification_id, draft_stage)
        values (p_room_id, v_player.user_id, v_opts.modification_ids[v_idx], p_draft_stage);
      end if;
    end if;
  end loop;

  if v_curr_idx = 3 then
    v_next_anomaly_id := _assign_anomaly(p_room_id, v_room_seed, 4);
    update rooms
    set
      status                    = 'anomaly_reveal',
      current_question_index    = 4,
      active_anomaly_id         = v_next_anomaly_id,
      current_phase_started_at  = now(),
      current_phase_duration_ms = 10000
    where id = p_room_id;
  else
    update rooms
    set
      status                    = 'question',
      current_question_index    = current_question_index + 1,
      active_anomaly_id         = null,
      current_phase_started_at  = now(),
      current_phase_duration_ms = 15000
    where id = p_room_id;
  end if;
end;
$$;
