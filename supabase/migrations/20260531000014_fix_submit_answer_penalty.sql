-- Fix: v_add_penalty was declared as bare `int` (NULL by default in PL/pgSQL).
-- For correct answers the wrong-answer branch never ran, so v_add_penalty stayed NULL.
-- answers.penalty is NOT NULL, causing a constraint violation (HTTP 400) on every
-- correct-answer submission.  Fix: initialize to 0.

create or replace function submit_answer(
  p_room_id        uuid,
  p_question_index int,
  p_answer         jsonb
)
returns jsonb
language plpgsql
security definer
as $$
declare
  v_room               record;
  v_player             record;
  v_q                  record;
  v_is_correct         boolean;
  v_elapsed_ms         int;
  v_response_ms        int;
  v_effective_ms       int;
  v_remaining_ms       int;
  v_profile_id         text;
  v_anomaly_id         text;
  v_prev_cat           uuid;
  v_curr_cat           uuid;
  v_player_rank        int;
  v_active_cnt         int;
  v_answered_cnt       int;

  -- Scoring
  v_base               int;
  v_speed              int;
  v_max_speed          int;
  v_flat               int;
  v_multiplier         numeric;
  v_total              int;
  v_penalty_base       int;
  v_add_penalty        int := 0;   -- was `int` (NULL); caused NOT NULL violation on correct answers

  -- Profile flags
  v_katalizator_pending boolean;
  v_null_available      boolean;
  v_stab_uses_left      int;

  -- Modification states (queried once at top)
  v_has_prog_pewnosci   boolean;
  v_has_opozniona       boolean;
  v_opozniona_qdiff     int;
  v_opozniona_stage     int;
  v_has_kalibracja      boolean;
  v_has_bezpiecznik     boolean;
  v_bezpiecznik_uses    int;
  v_has_reakcja         boolean;
  v_has_akcelerator     boolean;
  v_has_stabilizacja_w  boolean;
  v_has_transfer        boolean;
  v_has_odwrocenie      boolean;
  v_has_druga_proba     boolean;
  v_petla_next_bonus    boolean;
  v_has_petla           boolean;
  v_petla_uses          int;
  v_has_odbicie         boolean;
  v_odbicie_uses        int;
  v_has_kompensacja     boolean;
  v_has_proba_kryt      boolean;
  v_has_tarcza          boolean;
  v_has_wzmocnienie     boolean;
  v_nadpisanie_buffer   int;
  v_nadpisanie_set_at   int;
  v_has_cichy           boolean;
  v_has_rezonans        boolean;

  -- Breakdown
  v_lines              jsonb;
  v_breakdown          jsonb;
begin
  if auth.uid() is null then raise exception 'UNAUTHORIZED'; end if;

  -- ── Validation ──────────────────────────────────────────────────────────────

  select * into v_room from rooms where id = p_room_id;
  if not found then raise exception 'ROOM_NOT_FOUND'; end if;
  if v_room.status <> 'question' then raise exception 'WRONG_PHASE'; end if;
  if v_room.current_question_index <> p_question_index then raise exception 'WRONG_QUESTION'; end if;

  select * into v_player from room_players
  where room_id = p_room_id and user_id = auth.uid() and left_at is null;
  if not found then raise exception 'NOT_IN_ROOM'; end if;

  -- Grace: accept up to 1 s after timer
  v_elapsed_ms := (extract(epoch from now() - v_room.current_phase_started_at) * 1000)::int;
  if v_elapsed_ms > v_room.current_phase_duration_ms + 1000 then
    raise exception 'TIME_EXPIRED';
  end if;

  if exists (
    select 1 from answers
    where room_id = p_room_id and user_id = auth.uid() and question_index = p_question_index
  ) then raise exception 'ALREADY_ANSWERED'; end if;

  -- Load question
  select q.type, q.correct_answer, rq.anomaly_id, q.category_id
  into v_q
  from room_questions rq
  join questions q on q.id = rq.question_id
  where rq.room_id = p_room_id and rq.question_index = p_question_index;
  if not found then raise exception 'QUESTION_NOT_FOUND'; end if;

  v_anomaly_id := v_q.anomaly_id;
  v_curr_cat   := v_q.category_id;

  -- Load previous question category (for Archiwista)
  if p_question_index > 1 then
    select q.category_id into v_prev_cat
    from room_questions rq join questions q on q.id = rq.question_id
    where rq.room_id = p_room_id and rq.question_index = p_question_index - 1;
  end if;

  -- Correctness
  v_is_correct := (p_answer->>'id') = (v_q.correct_answer->>'id');

  -- Timing
  v_response_ms := least(v_elapsed_ms, v_room.current_phase_duration_ms);

  -- ── Load profile and modification state ──────────────────────────────────────

  v_profile_id := v_player.selected_profile_id;

  -- Katalizator pending
  v_katalizator_pending := coalesce((v_player.settings->>'katalizator_pending')::boolean, false);

  -- Null passive available (no wrong answer yet this game)
  select count(*) = 0 into v_null_available
  from answers
  where room_id = p_room_id and user_id = auth.uid() and is_correct = false;

  -- Stabilizator passive uses left: 2 minus wrong answers where it was active
  -- We approximate: 2 - min(wrong_answer_count, 2)
  declare v_wrong_cnt int;
  begin
    select count(*) into v_wrong_cnt
    from answers where room_id = p_room_id and user_id = auth.uid() and is_correct = false;
    v_stab_uses_left := greatest(0, 2 - v_wrong_cnt);
  end;

  -- Player rank before this answer (1 = leader)
  select count(*) + 1 into v_player_rank
  from room_players
  where room_id = p_room_id and left_at is null and score > v_player.score;

  select count(*) into v_active_cnt
  from room_players where room_id = p_room_id and left_at is null;

  -- Load modification states
  -- (query active mods: remaining_questions IS NULL or > 0; uses_remaining IS NULL or > 0)

  select count(*) > 0 into v_has_prog_pewnosci
  from player_modifications
  where room_id = p_room_id and user_id = auth.uid()
    and modification_id = 'prog-pewnosci'
    and (remaining_questions is null or remaining_questions > 0);

  select count(*) > 0, min(draft_stage) into v_has_opozniona, v_opozniona_stage
  from player_modifications
  where room_id = p_room_id and user_id = auth.uid()
    and modification_id = 'opozniona-reakcja';

  if v_has_opozniona then
    v_opozniona_qdiff := p_question_index - v_opozniona_stage;
  else
    v_opozniona_qdiff := 0;
  end if;

  -- Blocked check: qDiff 1 or 2 after draft
  if v_has_opozniona and v_opozniona_qdiff between 1 and 2 then
    return jsonb_build_object('lines', '[]'::jsonb, 'total', 0, 'blocked', true);
  end if;

  select count(*) > 0 into v_has_kalibracja
  from player_modifications
  where room_id = p_room_id and user_id = auth.uid()
    and modification_id = 'kalibracja-odruchu'
    and (remaining_questions is null or remaining_questions > 0);

  select count(*) > 0, coalesce(min(uses_remaining), 0) into v_has_bezpiecznik, v_bezpiecznik_uses
  from player_modifications
  where room_id = p_room_id and user_id = auth.uid()
    and modification_id = 'bezpiecznik'
    and (uses_remaining is null or uses_remaining > 0);

  select count(*) > 0 into v_has_reakcja
  from player_modifications
  where room_id = p_room_id and user_id = auth.uid()
    and modification_id = 'reakcja-lancuchowa'
    and (remaining_questions is null or remaining_questions > 0);

  select count(*) > 0 into v_has_akcelerator
  from player_modifications
  where room_id = p_room_id and user_id = auth.uid()
    and modification_id = 'akcelerator-decyzji'
    and (remaining_questions is null or remaining_questions > 0);

  select count(*) > 0 into v_has_stabilizacja_w
  from player_modifications
  where room_id = p_room_id and user_id = auth.uid()
    and modification_id = 'stabilizacja-wyniku'
    and (remaining_questions is null or remaining_questions > 0);

  select count(*) > 0 into v_has_transfer
  from player_modifications
  where room_id = p_room_id and user_id = auth.uid()
    and modification_id = 'transfer-impulsu'
    and (remaining_questions is null or remaining_questions > 0);

  select count(*) > 0, coalesce(min(uses_remaining), 0) into v_has_petla, v_petla_uses
  from player_modifications
  where room_id = p_room_id and user_id = auth.uid()
    and modification_id = 'petla-testowa'
    and (uses_remaining is null or uses_remaining > 0);

  -- Also check nextQBonus even when uses=0
  select coalesce((state->>'nextQBonus')::boolean, false) into v_petla_next_bonus
  from player_modifications
  where room_id = p_room_id and user_id = auth.uid()
    and modification_id = 'petla-testowa'
  limit 1;

  select count(*) > 0, coalesce(min(uses_remaining), 0) into v_has_odbicie, v_odbicie_uses
  from player_modifications
  where room_id = p_room_id and user_id = auth.uid()
    and modification_id = 'odbicie-sygnalu'
    and (uses_remaining is null or uses_remaining > 0);

  select count(*) > 0 into v_has_kompensacja
  from player_modifications
  where room_id = p_room_id and user_id = auth.uid()
    and modification_id = 'kompensacja-deficytu'
    and (remaining_questions is null or remaining_questions > 0);

  select count(*) > 0 into v_has_proba_kryt
  from player_modifications
  where room_id = p_room_id and user_id = auth.uid()
    and modification_id = 'proba-krytyczna'
    and (remaining_questions is null or remaining_questions > 0);

  select count(*) > 0 into v_has_tarcza
  from player_modifications
  where room_id = p_room_id and user_id = auth.uid()
    and modification_id = 'tarcza-fazowa'
    and (remaining_questions is null or remaining_questions > 0);

  select count(*) > 0 into v_has_wzmocnienie
  from player_modifications
  where room_id = p_room_id and user_id = auth.uid()
    and modification_id = 'wzmocnienie-sygnalu'
    and (remaining_questions is null or remaining_questions > 0);

  select
    coalesce((state->>'buffer')::int, 0),
    coalesce((state->>'buffer_set_at')::int, 0)
  into v_nadpisanie_buffer, v_nadpisanie_set_at
  from player_modifications
  where room_id = p_room_id and user_id = auth.uid()
    and modification_id = 'nadpisanie-wyniku'
  limit 1;
  if not found then
    v_nadpisanie_buffer := 0;
    v_nadpisanie_set_at := 0;
  end if;

  select count(*) > 0 into v_has_cichy
  from player_modifications
  where room_id = p_room_id and user_id = auth.uid()
    and modification_id = 'cichy-protokol'
    and (remaining_questions is null or remaining_questions > 0);

  select count(*) > 0 into v_has_rezonans
  from player_modifications
  where room_id = p_room_id and user_id = auth.uid()
    and modification_id = 'rezonans-koncowy'
    and (remaining_questions is null or remaining_questions > 0);

  -- ── 1. Effective question time ────────────────────────────────────────────

  v_effective_ms := v_room.current_phase_duration_ms;

  if v_profile_id = 'chronotyp' then
    v_effective_ms := v_effective_ms + 1000;
  end if;

  if v_has_akcelerator then
    v_effective_ms := greatest(1000, v_effective_ms - 3000);
  end if;

  if v_petla_next_bonus then
    v_effective_ms := v_effective_ms + 3000;
    update player_modifications
    set state = state - 'nextQBonus'
    where room_id = p_room_id and user_id = auth.uid()
      and modification_id = 'petla-testowa';
  end if;

  if v_anomaly_id = 'niestabilne-pole' then
    v_effective_ms := greatest(1000, v_effective_ms - 2000);
  end if;

  -- ── 2. Clamp response_ms to effective time ────────────────────────────────

  v_response_ms  := least(v_response_ms, v_effective_ms);
  v_remaining_ms := greatest(0, v_effective_ms - v_response_ms);

  -- ── 3. Base score ─────────────────────────────────────────────────────────

  v_lines := '[]'::jsonb;

  if v_is_correct then
    if v_anomaly_id = 'przesuniecie-fazowe' then
      v_base := 125;
      v_lines := v_lines || jsonb_build_array(
        jsonb_build_object('label', '+125 poprawna odpowiedź (Przesunięcie Fazowe)', 'value', 125)
      );
    else
      v_base := 100;
      v_lines := v_lines || jsonb_build_array(
        jsonb_build_object('label', '+100 poprawna odpowiedź', 'value', 100)
      );
    end if;
  else
    v_base := -25;
  end if;

  -- ── 4. Speed bonus ────────────────────────────────────────────────────────

  v_speed := 0;
  if v_is_correct and v_anomaly_id is distinct from 'przesuniecie-fazowe' then
    v_max_speed := case when v_anomaly_id = 'wzmocnienie-sygnalu' then 75 else 50 end;
    v_speed := floor(v_max_speed::numeric * v_remaining_ms / v_effective_ms)::int;
    if v_speed > 0 then
      v_lines := v_lines || jsonb_build_array(
        jsonb_build_object('label', '+' || v_speed || ' szybkość', 'value', v_speed)
      );
    end if;
  end if;

  -- ── 5. Flat bonuses (correct only) ────────────────────────────────────────

  v_flat := 0;

  if v_is_correct then
    -- Katalizator passive (+40 on first correct after mod selection)
    if v_profile_id = 'katalizator' and v_katalizator_pending then
      v_flat := v_flat + 40;
      v_lines := v_lines || jsonb_build_array(
        jsonb_build_object('label', '+40 Katalizator (pierwsza poprawna po Modyfikacji)', 'value', 40)
      );
      update room_players
      set settings = settings - 'katalizator_pending'
      where room_id = p_room_id and user_id = auth.uid();
    end if;

    -- Wektor passive (+25 if ≤ 4 s)
    if v_profile_id = 'wektor' and v_response_ms <= 4000 then
      v_flat := v_flat + 25;
      v_lines := v_lines || jsonb_build_array(
        jsonb_build_object('label', '+25 Wektor (≤4s)', 'value', 25)
      );
    end if;

    -- Synapsa passive (+60 per streak multiple of 3)
    if v_profile_id = 'synapsa' and (v_player.streak + 1) % 3 = 0 then
      v_flat := v_flat + 60;
      v_lines := v_lines || jsonb_build_array(
        jsonb_build_object('label', '+60 Synapsa (seria ×' || (v_player.streak+1) || ')', 'value', 60)
      );
    end if;

    -- Archiwista passive (+50 same category as previous)
    if v_profile_id = 'archiwista' and v_prev_cat is not null and v_prev_cat = v_curr_cat then
      v_flat := v_flat + 50;
      v_lines := v_lines || jsonb_build_array(
        jsonb_build_object('label', '+50 Archiwista (ta sama kategoria)', 'value', 50)
      );
    end if;

    -- Fraktal passive (+30 if lower half)
    if v_profile_id = 'fraktal' and v_player_rank > ceil(v_active_cnt::numeric / 2) then
      v_flat := v_flat + 30;
      v_lines := v_lines || jsonb_build_array(
        jsonb_build_object('label', '+30 Fraktal (dolna połowa)', 'value', 30)
      );
    end if;

    -- Wzmocnienie Sygnału mod (+30)
    if v_has_wzmocnienie then
      v_flat := v_flat + 30;
      v_lines := v_lines || jsonb_build_array(
        jsonb_build_object('label', '+30 Wzmocnienie Sygnału', 'value', 30)
      );
    end if;

    -- Kalibracja Odruchu (+35 if ≤ 4 s)
    if v_has_kalibracja and v_response_ms <= 4000 then
      v_flat := v_flat + 35;
      v_lines := v_lines || jsonb_build_array(
        jsonb_build_object('label', '+35 Kalibracja Odruchu (≤4s)', 'value', 35)
      );
    end if;

    -- Reakcja Łańcuchowa (streak bonuses)
    if v_has_reakcja then
      declare v_streak_bonus int;
      begin
        v_streak_bonus := case
          when v_player.streak + 1 >= 4 then 60
          when v_player.streak + 1 = 3  then 40
          when v_player.streak + 1 = 2  then 20
          else 0
        end;
        if v_streak_bonus > 0 then
          v_flat := v_flat + v_streak_bonus;
          v_lines := v_lines || jsonb_build_array(
            jsonb_build_object('label', '+' || v_streak_bonus || ' Reakcja Łańcuchowa (seria ×' || (v_player.streak+1) || ')', 'value', v_streak_bonus)
          );
        end if;
      end;
    end if;

    -- Próba Krytyczna (+100 if correct)
    if v_has_proba_kryt then
      v_flat := v_flat + 100;
      v_lines := v_lines || jsonb_build_array(
        jsonb_build_object('label', '+100 Próba Krytyczna (poprawna)', 'value', 100)
      );
    end if;

    -- Cichy Protokół (+40 if not leader)
    if v_has_cichy and v_player_rank > 1 then
      v_flat := v_flat + 40;
      v_lines := v_lines || jsonb_build_array(
        jsonb_build_object('label', '+40 Cichy Protokół (nie lider)', 'value', 40)
      );
    end if;

    -- Nadpisanie Wyniku: payout when ≥ 2 questions passed since set
    if v_nadpisanie_buffer > 0 and v_nadpisanie_set_at > 0
       and p_question_index - v_nadpisanie_set_at >= 2 then
      v_flat := v_flat + v_nadpisanie_buffer;
      v_lines := v_lines || jsonb_build_array(
        jsonb_build_object('label', '+' || v_nadpisanie_buffer || ' Nadpisanie Wyniku (wypłata)', 'value', v_nadpisanie_buffer)
      );
      update player_modifications
      set state = '{"buffer": 0, "buffer_set_at": 0}'::jsonb
      where room_id = p_room_id and user_id = auth.uid()
        and modification_id = 'nadpisanie-wyniku';
      v_nadpisanie_buffer := 0;
    end if;
  end if;

  -- ── 6. Multiplier ─────────────────────────────────────────────────────────

  v_multiplier := 1.0;

  if v_is_correct then
    if v_profile_id = 'horyzont' and p_question_index >= 10 then
      v_multiplier := v_multiplier + 0.20;
    end if;

    if v_has_prog_pewnosci      then v_multiplier := v_multiplier + 0.50; end if;
    if v_has_opozniona and v_opozniona_qdiff > 2
                                then v_multiplier := v_multiplier + 0.25; end if;
    if v_has_akcelerator        then v_multiplier := v_multiplier + 0.40; end if;
    if v_has_kompensacja and v_player_rank > ceil(v_active_cnt::numeric / 2)
                                then v_multiplier := v_multiplier + 0.25; end if;
    if v_has_rezonans and p_question_index >= 10 and v_player_rank > 1
                                then v_multiplier := v_multiplier + 0.30; end if;
    if v_anomaly_id = 'fluktuacja-wyniku'
                                then v_multiplier := v_multiplier + 0.20; end if;

    v_multiplier := greatest(0, v_multiplier);

    -- Compute correct-answer total
    v_total := round((v_base + v_speed + v_flat)::numeric * v_multiplier)::int;

    if v_multiplier <> 1.0 then
      v_lines := v_lines || jsonb_build_array(
        jsonb_build_object(
          'label', '×' || round(v_multiplier, 2) || ' multiplikator',
          'value', v_total - (v_base + v_speed + v_flat)
        )
      );
    end if;

    v_lines := v_lines || jsonb_build_array(
      jsonb_build_object('label', '= razem', 'value', v_total)
    );

    -- Nadpisanie Wyniku: set buffer on FIRST correct (buffer not yet active)
    if v_nadpisanie_buffer = 0 and exists (
      select 1 from player_modifications
      where room_id = p_room_id and user_id = auth.uid()
        and modification_id = 'nadpisanie-wyniku'
        and (remaining_questions is null or remaining_questions > 0)
    ) and v_nadpisanie_set_at = 0 then
      update player_modifications
      set state = jsonb_build_object('buffer', 100, 'buffer_set_at', p_question_index)
      where room_id = p_room_id and user_id = auth.uid()
        and modification_id = 'nadpisanie-wyniku';
    end if;

  else
    -- ── Wrong answer: shields and penalties ───────────────────────────────────

    v_penalty_base := -25;
    v_add_penalty  := 0;
    declare v_shielded boolean := false;
    begin
      -- Full shields (priority order)
      if v_profile_id = 'null' and v_null_available and not v_shielded then
        v_penalty_base := 0;
        v_shielded := true;
        v_lines := v_lines || jsonb_build_array(
          jsonb_build_object('label', 'Null (pasywna — pierwsza błędna bez kary)', 'value', 0)
        );
      end if;

      if v_has_bezpiecznik and v_bezpiecznik_uses > 0 and not v_shielded then
        v_penalty_base := 0;
        v_shielded := true;
        v_lines := v_lines || jsonb_build_array(
          jsonb_build_object('label', 'Bezpiecznik (pierwsza błędna bez kary)', 'value', 0)
        );
        update player_modifications
        set uses_remaining = 0
        where room_id = p_room_id and user_id = auth.uid()
          and modification_id = 'bezpiecznik';
      end if;

      if v_has_petla and v_petla_uses > 0 and not v_shielded then
        v_penalty_base := 0;
        v_shielded := true;
        v_lines := v_lines || jsonb_build_array(
          jsonb_build_object('label', 'Pętla Testowa (kara anulowana + +3s następne)', 'value', 0)
        );
        update player_modifications
        set uses_remaining = 0,
            state = jsonb_set(coalesce(state, '{}'), '{nextQBonus}', 'true')
        where room_id = p_room_id and user_id = auth.uid()
          and modification_id = 'petla-testowa';
      end if;

      -- Partial reductions (if not fully shielded)
      if not v_shielded then
        if v_profile_id = 'stabilizator' and v_stab_uses_left > 0 then
          v_penalty_base := -floor(25.0 / 2)::int;  -- -12
        end if;
        if v_has_stabilizacja_w then
          v_penalty_base := least(v_penalty_base + 50, 0);
        end if;
        v_lines := v_lines || jsonb_build_array(
          jsonb_build_object('label', v_penalty_base || ' błędna odpowiedź', 'value', v_penalty_base)
        );
      end if;

      -- Additional penalties
      if v_has_prog_pewnosci then
        v_add_penalty := v_add_penalty + 75;
        v_lines := v_lines || jsonb_build_array(
          jsonb_build_object('label', '-75 Próg Pewności (kara za błąd)', 'value', -75)
        );
      end if;
      if v_has_proba_kryt then
        v_add_penalty := v_add_penalty + 100;
        v_lines := v_lines || jsonb_build_array(
          jsonb_build_object('label', '-100 Próba Krytyczna (kara za błąd)', 'value', -100)
        );
      end if;
      if v_anomaly_id = 'fluktuacja-wyniku' then
        v_add_penalty := v_add_penalty + 25;
        v_lines := v_lines || jsonb_build_array(
          jsonb_build_object('label', '-25 Fluktuacja Wyniku (kara)', 'value', -25)
        );
      end if;

      v_total := v_penalty_base - v_add_penalty;

      v_lines := v_lines || jsonb_build_array(
        jsonb_build_object('label', '= razem', 'value', v_total)
      );
    end;

    -- Nadpisanie Wyniku: wrong answer clears buffer
    update player_modifications
    set state = '{"buffer": 0, "buffer_set_at": 0}'::jsonb
    where room_id = p_room_id and user_id = auth.uid()
      and modification_id = 'nadpisanie-wyniku'
      and (state->>'buffer')::int > 0;
  end if;

  v_breakdown := jsonb_build_object('lines', v_lines, 'total', v_total);

  -- ── Insert answer record ──────────────────────────────────────────────────

  insert into answers (
    room_id, user_id, question_index, question_id,
    answer, is_correct, response_ms,
    base_points, speed_bonus, flat_bonus, multiplier, penalty, total_points, breakdown
  )
  select
    p_room_id, auth.uid(), p_question_index, rq.question_id,
    p_answer, v_is_correct, v_response_ms,
    v_base, v_speed, v_flat, v_multiplier,
    v_add_penalty, v_total, v_breakdown
  from room_questions rq
  where rq.room_id = p_room_id and rq.question_index = p_question_index;

  -- ── Update score and streak ───────────────────────────────────────────────

  if v_is_correct then
    update room_players
    set score  = score + v_total,
        streak = streak + 1
    where room_id = p_room_id and user_id = auth.uid();
  else
    update room_players
    set score  = score + v_total,
        streak = 0
    where room_id = p_room_id and user_id = auth.uid();
  end if;

  -- ── Decrement remaining_questions on all time-limited active mods ─────────
  -- (Opóźniona Reakcja uses draftStage logic instead, so exclude it)

  update player_modifications
  set remaining_questions = remaining_questions - 1
  where room_id = p_room_id
    and user_id = auth.uid()
    and remaining_questions is not null
    and remaining_questions > 0
    and modification_id <> 'opozniona-reakcja';

  -- ── Auto-advance to results if all active players have answered ───────────

  select count(*) into v_answered_cnt
  from answers where room_id = p_room_id and question_index = p_question_index;

  if v_answered_cnt >= v_active_cnt then
    update rooms
    set
      status                    = 'results',
      current_phase_started_at  = now(),
      current_phase_duration_ms = 6000
    where id = p_room_id;
  end if;

  return v_breakdown;
end;
$$;
