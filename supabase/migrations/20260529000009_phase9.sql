-- Phase 9: Anomalie rundy
-- Adds anomaly_reveal room status. Before questions 4 and 8, all players see
-- AnomalyBanner for 5 s, then the question starts with its full 15 s timer.
-- The anomaly effect on scoring is already implemented in submit_answer (Phase 8).

-- ─────────────────────────────────────────────────────────────────────────────
-- Add anomaly_reveal to room_status enum
-- ─────────────────────────────────────────────────────────────────────────────
alter type room_status add value if not exists 'anomaly_reveal';

-- ─────────────────────────────────────────────────────────────────────────────
-- _assign_anomaly: compute deterministic anomaly for a question and write it
-- to room_questions.anomaly_id. Returns the anomaly id (or null).
-- ─────────────────────────────────────────────────────────────────────────────
create or replace function _assign_anomaly(
  p_room_id        uuid,
  p_room_seed      text,
  p_question_index int
)
returns text
language plpgsql
security definer
as $$
declare
  v_anomaly_ids  text[];
  v_anomaly_id   text;
  v_seed_float   float8;
  v_anomaly_idx  int;
begin
  select array_agg(id order by id) into v_anomaly_ids
  from anomalies where is_enabled = true;

  if v_anomaly_ids is null or array_length(v_anomaly_ids, 1) = 0 then
    return null;
  end if;

  v_seed_float := hashtext(
    p_room_seed || ':anomaly:' || p_question_index::text
  )::float8 / 2147483648.0;
  perform setseed(v_seed_float);
  v_anomaly_idx := floor(random() * array_length(v_anomaly_ids, 1))::int + 1;
  v_anomaly_id  := v_anomaly_ids[v_anomaly_idx];

  update room_questions
  set anomaly_id = v_anomaly_id
  where room_id = p_room_id and question_index = p_question_index;

  return v_anomaly_id;
end;
$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- select_modification — Phase 9 update:
-- When advancing to q4 (after mod draft at q3), go to anomaly_reveal (5 s)
-- instead of directly to question. All other transitions unchanged.
-- Full Phase 8 body re-declared.
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
  v_room             record;
  v_opts             record;
  v_active_cnt       int;
  v_selected_cnt     int;
  v_profile_id       text;
  v_init_rq          int;
  v_init_ur          int;
  v_init_state       jsonb;
  v_is_time_based    boolean;
  v_has_time_based   boolean;
  v_next_anomaly_id  text;
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
  where room_id = p_room_id and user_id = auth.uid() and draft_stage = p_draft_stage;
  if not found then raise exception 'NO_OPTIONS'; end if;
  if v_opts.selected_modification_id is not null then raise exception 'ALREADY_SELECTED'; end if;

  if p_modification_id != all(v_opts.modification_ids) then
    raise exception 'INVALID_MODIFICATION';
  end if;

  -- ── Initial state per modification ──
  v_init_state := '{}'::jsonb;
  v_init_rq    := null;
  v_init_ur    := null;

  case p_modification_id
    when 'prog-pewnosci'           then v_init_rq := 2;
    when 'opozniona-reakcja'       then v_init_rq := null;
    when 'kalibracja-odruchu'      then v_init_rq := null;
    when 'bezpiecznik'             then v_init_ur := 1;
    when 'reakcja-lancuchowa'      then v_init_rq := null;
    when 'akcelerator-decyzji'     then v_init_rq := 3;
    when 'stabilizacja-wyniku'     then v_init_rq := 4;
    when 'skan-trudnosci'          then v_init_rq := null;
    when 'interferencja-lidera'    then v_init_rq := 1;
    when 'zaklocenie-kanalu'       then v_init_rq := 2;
    when 'transfer-impulsu'        then v_init_rq := 3;
    when 'odwrocenie-polaryzacji'  then v_init_ur := 1;
    when 'druga-proba'             then v_init_ur := 1;
    when 'petla-testowa'           then
      v_init_ur    := 1;
      v_init_state := '{"nextQBonus": false}'::jsonb;
    when 'odbicie-sygnalu'         then v_init_ur := 1;
    when 'kompensacja-deficytu'    then v_init_rq := null;
    when 'proba-krytyczna'         then v_init_rq := 1;
    when 'tarcza-fazowa'           then v_init_rq := 2;
    when 'analiza-wstepna'         then v_init_rq := 4;
    when 'wzmocnienie-sygnalu'     then v_init_rq := 3;
    when 'nadpisanie-wyniku'       then
      v_init_rq    := null;
      v_init_state := '{"buffer": 0, "buffer_set_at": 0}'::jsonb;
    when 'cichy-protokol'          then v_init_rq := 2;
    when 'rezonans-koncowy'        then v_init_rq := null;
    else null;
  end case;

  v_is_time_based := (v_init_rq is not null and p_modification_id not in (
    'opozniona-reakcja', 'kalibracja-odruchu', 'reakcja-lancuchowa',
    'skan-trudnosci', 'kompensacja-deficytu', 'rezonans-koncowy', 'nadpisanie-wyniku'
  ));

  select selected_profile_id into v_profile_id
  from room_players where room_id = p_room_id and user_id = auth.uid();

  if v_profile_id = 'przekaznik' and v_is_time_based and v_init_rq is not null then
    select count(*) > 0 into v_has_time_based
    from player_modifications
    where room_id = p_room_id and user_id = auth.uid()
      and modification_id in (
        'prog-pewnosci','akcelerator-decyzji','stabilizacja-wyniku',
        'interferencja-lidera','zaklocenie-kanalu','transfer-impulsu',
        'proba-krytyczna','tarcza-fazowa','analiza-wstepna','wzmocnienie-sygnalu','cichy-protokol'
      );
    if not v_has_time_based then
      v_init_rq := v_init_rq + 1;
    end if;
  end if;

  update room_modification_options
  set selected_modification_id = p_modification_id,
      selected_at = now()
  where room_id = p_room_id and user_id = auth.uid() and draft_stage = p_draft_stage;

  insert into player_modifications
    (room_id, user_id, modification_id, draft_stage, remaining_questions, uses_remaining, state)
  values
    (p_room_id, auth.uid(), p_modification_id, p_draft_stage, v_init_rq, v_init_ur, v_init_state);

  if v_profile_id = 'katalizator' then
    update room_players
    set settings = jsonb_set(settings, '{katalizator_pending}', 'true')
    where room_id = p_room_id and user_id = auth.uid();
  end if;

  select count(*) into v_active_cnt
  from room_players where room_id = p_room_id and left_at is null;

  select count(*) into v_selected_cnt
  from room_modification_options
  where room_id = p_room_id and draft_stage = p_draft_stage
    and selected_modification_id is not null;

  if v_selected_cnt >= v_active_cnt then
    if v_room.current_question_index = 3 then
      -- Next is q4, which has an anomaly: show banner first
      v_next_anomaly_id := _assign_anomaly(p_room_id, v_room.seed, 4);
      update rooms
      set
        status                    = 'anomaly_reveal',
        current_question_index    = 4,
        active_anomaly_id         = v_next_anomaly_id,
        current_phase_started_at  = now(),
        current_phase_duration_ms = 5000
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
  end if;
end;
$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- prepare_modification_draft — Phase 9 update:
-- Same anomaly_reveal logic as select_modification for the advance section.
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
  v_player          record;
  v_opts            record;
  v_idx             int;
  v_next_anomaly_id text;
begin
  if auth.uid() is null then raise exception 'UNAUTHORIZED'; end if;

  select status, seed, current_question_index
  into v_status, v_room_seed, v_curr_idx
  from rooms where id = p_room_id;
  if not found then raise exception 'ROOM_NOT_FOUND'; end if;
  if v_status <> 'modification_draft' then return; end if;

  if not exists (
    select 1 from room_players
    where room_id = p_room_id and user_id = auth.uid() and left_at is null
  ) then raise exception 'NOT_IN_ROOM'; end if;

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
      current_phase_duration_ms = 5000
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

-- ─────────────────────────────────────────────────────────────────────────────
-- advance_room_phase — Phase 9 update:
-- - anomaly_reveal → question (after 5 s)
-- - results after q7 → anomaly_reveal for q8 (instead of directly to question)
-- ─────────────────────────────────────────────────────────────────────────────
create or replace function advance_room_phase(p_room_id uuid)
returns void
language plpgsql
security definer
as $$
declare
  v_room            record;
  v_elapsed_ms      int;
  v_active_cnt      int;
  v_answered_cnt    int;
  v_next_idx        int;
  v_next_anomaly_id text;
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

  elsif v_room.status = 'anomaly_reveal' then
    if v_elapsed_ms < v_room.current_phase_duration_ms then return; end if;

    -- Transition to the designated question (current_question_index and
    -- active_anomaly_id were already set when entering anomaly_reveal)
    update rooms
    set
      status                    = 'question',
      current_phase_started_at  = now(),
      current_phase_duration_ms = 15000
    where id = p_room_id;

  elsif v_room.status = 'results' then
    if v_elapsed_ms < v_room.current_phase_duration_ms then return; end if;

    if v_room.current_question_index >= 12 then
      update rooms set status = 'finished', finished_at = now() where id = p_room_id;

    elsif v_room.current_question_index in (3, 6, 9) then
      perform _execute_prepare_modification_draft(p_room_id, v_room.current_question_index);

    else
      v_next_idx := v_room.current_question_index + 1;

      if v_next_idx = 8 then
        -- q8 is an anomaly question: assign anomaly and show banner
        v_next_anomaly_id := _assign_anomaly(p_room_id, v_room.seed, 8);
        update rooms
        set
          status                    = 'anomaly_reveal',
          current_question_index    = 8,
          active_anomaly_id         = v_next_anomaly_id,
          current_phase_started_at  = now(),
          current_phase_duration_ms = 5000
        where id = p_room_id;
      else
        update rooms
        set
          status                    = 'question',
          current_question_index    = v_next_idx,
          active_anomaly_id         = null,
          current_phase_started_at  = now(),
          current_phase_duration_ms = 15000
        where id = p_room_id;
      end if;
    end if;
  end if;
end;
$$;
