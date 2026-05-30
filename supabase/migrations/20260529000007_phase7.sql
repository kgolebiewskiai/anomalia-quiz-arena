-- Phase 7: Modification Draft (after questions 3, 6, 9)

-- ─────────────────────────────────────────────────────────────────────────────
-- Realtime: modification options
-- ─────────────────────────────────────────────────────────────────────────────
alter publication supabase_realtime add table room_modification_options;

-- ─────────────────────────────────────────────────────────────────────────────
-- RLS update: allow room members to read ALL modification options in their room
-- (needed for "X/Y selected" count display)
-- ─────────────────────────────────────────────────────────────────────────────
drop policy if exists "room_modification_options: own row" on room_modification_options;

create policy "room_modification_options: read same room"
  on room_modification_options for select
  using (
    room_id in (
      select room_id from room_players where user_id = auth.uid()
    )
  );
-- Writes go through SECURITY DEFINER RPCs only.

-- ─────────────────────────────────────────────────────────────────────────────
-- _execute_prepare_modification_draft(p_room_id, p_draft_stage)
-- Internal: generates 3 modification options per active player using seeded
-- Fisher-Yates, excluding mods already picked by each player. Transitions
-- room to modification_draft with a 25 s timer.
-- Idempotent: skips players who already have options for this stage.
-- ─────────────────────────────────────────────────────────────────────────────
create or replace function _execute_prepare_modification_draft(
  p_room_id    uuid,
  p_draft_stage int
)
returns void
language plpgsql
security definer
as $$
declare
  v_room        record;
  v_player      record;
  v_all_ids     text[];
  v_used_ids    text[];
  v_pool        text[];
  v_n           int;
  v_shuffled    text[];
  v_i           int;
  v_j           int;
  v_tmp         text;
  v_seed_float  float8;
begin
  select * into v_room from rooms where id = p_room_id;
  -- Only run when in results phase at the correct question index
  if v_room.status <> 'results' then return; end if;
  if v_room.current_question_index <> p_draft_stage then return; end if;

  -- All enabled modification IDs (stable order)
  select array_agg(id order by id)
  into v_all_ids
  from modifications
  where is_enabled = true;

  if v_all_ids is null or array_length(v_all_ids, 1) < 3 then
    raise exception 'NOT_ENOUGH_MODIFICATIONS';
  end if;

  for v_player in
    select user_id from room_players
    where room_id = p_room_id and left_at is null
  loop
    -- Idempotent: skip if options already generated for this stage
    if exists (
      select 1 from room_modification_options
      where room_id = p_room_id
        and user_id = v_player.user_id
        and draft_stage = p_draft_stage
    ) then continue; end if;

    -- Mods already selected by this player in prior drafts
    select array_agg(modification_id)
    into v_used_ids
    from player_modifications
    where room_id = p_room_id and user_id = v_player.user_id;

    if v_used_ids is not null then
      select array_agg(m order by m)
      into v_pool
      from unnest(v_all_ids) m
      where m <> all(v_used_ids);
    else
      v_pool := v_all_ids;
    end if;

    -- Fall back to full pool if not enough unique mods remain
    if v_pool is null or array_length(v_pool, 1) < 3 then
      v_pool := v_all_ids;
    end if;

    v_n := array_length(v_pool, 1);

    -- Seeded Fisher-Yates per player
    v_seed_float := hashtext(
      v_room.seed || ':modification:' || v_player.user_id::text || ':' || p_draft_stage::text
    )::float8 / 2147483648.0;
    perform setseed(v_seed_float);

    v_shuffled := v_pool;
    for v_i in reverse v_n..2 loop
      v_j             := floor(random() * v_i)::int + 1;
      v_tmp           := v_shuffled[v_i];
      v_shuffled[v_i] := v_shuffled[v_j];
      v_shuffled[v_j] := v_tmp;
    end loop;

    insert into room_modification_options (room_id, user_id, draft_stage, modification_ids)
    values (p_room_id, v_player.user_id, p_draft_stage,
            array[v_shuffled[1], v_shuffled[2], v_shuffled[3]]);
  end loop;

  -- Transition room to modification_draft with 25 s timer
  update rooms
  set
    status                    = 'modification_draft',
    current_phase_started_at  = now(),
    current_phase_duration_ms = 25000
  where id = p_room_id;
end;
$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- select_modification(p_room_id, p_draft_stage, p_modification_id)
-- Player selects one of their 3 offered modifications.
-- Auto-advances to next question when all active players have selected.
-- ─────────────────────────────────────────────────────────────────────────────
create or replace function select_modification(
  p_room_id         uuid,
  p_draft_stage     int,
  p_modification_id text
)
returns void
language plpgsql
security definer
as $$
declare
  v_room         record;
  v_opts         record;
  v_active_cnt   int;
  v_selected_cnt int;
begin
  if auth.uid() is null then raise exception 'UNAUTHORIZED'; end if;

  select * into v_room from rooms where id = p_room_id;
  if not found then raise exception 'ROOM_NOT_FOUND'; end if;
  if v_room.status <> 'modification_draft' then raise exception 'WRONG_PHASE'; end if;

  if not exists (
    select 1 from room_players
    where room_id = p_room_id and user_id = auth.uid() and left_at is null
  ) then raise exception 'NOT_IN_ROOM'; end if;

  select * into v_opts
  from room_modification_options
  where room_id = p_room_id
    and user_id = auth.uid()
    and draft_stage = p_draft_stage;
  if not found then raise exception 'NO_OPTIONS'; end if;
  if v_opts.selected_modification_id is not null then raise exception 'ALREADY_SELECTED'; end if;

  -- Validate choice is in player's offered options
  if p_modification_id != all(v_opts.modification_ids) then
    raise exception 'INVALID_MODIFICATION';
  end if;

  -- Record selection
  update room_modification_options
  set selected_modification_id = p_modification_id,
      selected_at = now()
  where room_id = p_room_id
    and user_id = auth.uid()
    and draft_stage = p_draft_stage;

  -- Record in player_modifications (used to exclude from future drafts)
  insert into player_modifications (room_id, user_id, modification_id, draft_stage)
  values (p_room_id, auth.uid(), p_modification_id, p_draft_stage);

  -- Auto-advance to next question when everyone has selected
  select count(*) into v_active_cnt
  from room_players where room_id = p_room_id and left_at is null;

  select count(*) into v_selected_cnt
  from room_modification_options
  where room_id = p_room_id
    and draft_stage = p_draft_stage
    and selected_modification_id is not null;

  if v_selected_cnt >= v_active_cnt then
    update rooms
    set
      status                    = 'question',
      current_question_index    = current_question_index + 1,
      current_phase_started_at  = now(),
      current_phase_duration_ms = 15000
    where id = p_room_id;
  end if;
end;
$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- prepare_modification_draft(p_room_id, p_draft_stage)
-- Public timeout fallback: any room member can call this when the 25 s timer
-- expires. Assigns random mods to players who haven't chosen, then advances
-- to the next question.
-- ─────────────────────────────────────────────────────────────────────────────
create or replace function prepare_modification_draft(p_room_id uuid, p_draft_stage int)
returns void
language plpgsql
security definer
as $$
declare
  v_status room_status;
  v_player record;
  v_opts   record;
  v_idx    int;
begin
  if auth.uid() is null then raise exception 'UNAUTHORIZED'; end if;

  select status into v_status from rooms where id = p_room_id;
  if not found then raise exception 'ROOM_NOT_FOUND'; end if;
  -- Idempotent: no-op if room has already moved on
  if v_status <> 'modification_draft' then return; end if;

  if not exists (
    select 1 from room_players
    where room_id = p_room_id and user_id = auth.uid() and left_at is null
  ) then raise exception 'NOT_IN_ROOM'; end if;

  -- Auto-assign random mod to any player who hasn't chosen yet
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

      -- Only insert if not already recorded (race-condition guard)
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

  -- Advance to next question
  update rooms
  set
    status                    = 'question',
    current_question_index    = current_question_index + 1,
    current_phase_started_at  = now(),
    current_phase_duration_ms = 15000
  where id = p_room_id;
end;
$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- advance_room_phase — updated to route to modification_draft after q3/6/9
-- ─────────────────────────────────────────────────────────────────────────────
create or replace function advance_room_phase(p_room_id uuid)
returns void
language plpgsql
security definer
as $$
declare
  v_room         record;
  v_elapsed_ms   int;
  v_active_cnt   int;
  v_answered_cnt int;
  v_next_idx     int;
begin
  if auth.uid() is null then raise exception 'UNAUTHORIZED'; end if;

  if not exists (
    select 1 from room_players
    where room_id = p_room_id and user_id = auth.uid() and left_at is null
  ) then raise exception 'NOT_IN_ROOM'; end if;

  select * into v_room from rooms where id = p_room_id;
  if not found then raise exception 'ROOM_NOT_FOUND'; end if;

  v_elapsed_ms := (extract(epoch from now() - v_room.current_phase_started_at) * 1000)::int;

  if v_room.status = 'question' then
    select count(*) into v_active_cnt
    from room_players where room_id = p_room_id and left_at is null;

    select count(*) into v_answered_cnt
    from answers where room_id = p_room_id and question_index = v_room.current_question_index;

    if v_answered_cnt < v_active_cnt
       and v_elapsed_ms <= v_room.current_phase_duration_ms then
      return;
    end if;

    update rooms
    set
      status                    = 'results',
      current_phase_started_at  = now(),
      current_phase_duration_ms = 6000
    where id = p_room_id;

  elsif v_room.status = 'results' then
    if v_elapsed_ms < v_room.current_phase_duration_ms then return; end if;

    if v_room.current_question_index >= 12 then
      update rooms
      set status = 'finished', finished_at = now()
      where id = p_room_id;
    elsif v_room.current_question_index in (3, 6, 9) then
      -- Trigger modification draft
      perform _execute_prepare_modification_draft(p_room_id, v_room.current_question_index);
    else
      v_next_idx := v_room.current_question_index + 1;
      update rooms
      set
        status                    = 'question',
        current_question_index    = v_next_idx,
        current_phase_started_at  = now(),
        current_phase_duration_ms = 15000
      where id = p_room_id;
    end if;
  end if;
end;
$$;
