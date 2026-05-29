-- Phase 6: Questions + basic scoring

-- ─────────────────────────────────────────────────────────────────────────────
-- Realtime: answers table
-- ─────────────────────────────────────────────────────────────────────────────
alter publication supabase_realtime add table answers;

-- ─────────────────────────────────────────────────────────────────────────────
-- RLS: answers — allow room members to read all answers (for results screen)
-- ─────────────────────────────────────────────────────────────────────────────
drop policy if exists "answers: own row" on answers;

create policy "answers: read same room"
  on answers for select
  using (
    room_id in (
      select room_id from room_players where user_id = auth.uid()
    )
  );
-- Writes go through SECURITY DEFINER RPCs, so no insert/update policies needed.

-- ─────────────────────────────────────────────────────────────────────────────
-- Seed sample questions (for testing Phase 6)
-- ─────────────────────────────────────────────────────────────────────────────
do $$
declare
  cat_historia  uuid;
  cat_nauka     uuid;
  cat_geografia uuid;
  cat_kultura   uuid;
  cat_sport     uuid;
  cat_tech      uuid;
  cat_przyroda  uuid;
  cat_mat       uuid;
begin
  select id into cat_historia  from categories where name = 'Historia';
  select id into cat_nauka     from categories where name = 'Nauka';
  select id into cat_geografia from categories where name = 'Geografia';
  select id into cat_kultura   from categories where name = 'Kultura i sztuka';
  select id into cat_sport     from categories where name = 'Sport';
  select id into cat_tech      from categories where name = 'Technologia';
  select id into cat_przyroda  from categories where name = 'Przyroda';
  select id into cat_mat       from categories where name = 'Matematyka';

  -- Historia – single_choice
  insert into questions (type, category_id, difficulty, question_text, options, correct_answer, is_ranked_safe) values
  ('single_choice', cat_historia, 'easy',
   'W którym roku odbyła się Bitwa pod Grunwaldem?',
   '[{"id":"A","text":"1385"},{"id":"B","text":"1410"},{"id":"C","text":"1466"},{"id":"D","text":"1525"}]',
   '{"id":"B"}', true),
  ('single_choice', cat_historia, 'medium',
   'Kto był pierwszym prezydentem Stanów Zjednoczonych?',
   '[{"id":"A","text":"John Adams"},{"id":"B","text":"Benjamin Franklin"},{"id":"C","text":"George Washington"},{"id":"D","text":"Thomas Jefferson"}]',
   '{"id":"C"}', true),
  ('single_choice', cat_historia, 'medium',
   'W którym roku padł Mur Berliński?',
   '[{"id":"A","text":"1987"},{"id":"B","text":"1988"},{"id":"C","text":"1989"},{"id":"D","text":"1991"}]',
   '{"id":"C"}', true);

  -- Historia – true_false
  insert into questions (type, category_id, difficulty, question_text, options, correct_answer, is_ranked_safe) values
  ('true_false', cat_historia, 'easy',
   'Napoleon Bonaparte urodził się na Korsyce.',
   '[{"id":"A","text":"Prawda"},{"id":"B","text":"Fałsz"}]',
   '{"id":"A"}', true),
  ('true_false', cat_historia, 'medium',
   'II Wojna Światowa zakończyła się w 1944 roku.',
   '[{"id":"A","text":"Prawda"},{"id":"B","text":"Fałsz"}]',
   '{"id":"B"}', true);

  -- Nauka – single_choice
  insert into questions (type, category_id, difficulty, question_text, options, correct_answer, is_ranked_safe) values
  ('single_choice', cat_nauka, 'easy',
   'Ile planet liczy Układ Słoneczny?',
   '[{"id":"A","text":"7"},{"id":"B","text":"8"},{"id":"C","text":"9"},{"id":"D","text":"10"}]',
   '{"id":"B"}', true),
  ('single_choice', cat_nauka, 'easy',
   'Jaki jest symbol chemiczny złota?',
   '[{"id":"A","text":"Go"},{"id":"B","text":"Ag"},{"id":"C","text":"Au"},{"id":"D","text":"Pt"}]',
   '{"id":"C"}', true),
  ('single_choice', cat_nauka, 'medium',
   'Szybkość światła w próżni wynosi około:',
   '[{"id":"A","text":"30 000 km/s"},{"id":"B","text":"150 000 km/s"},{"id":"C","text":"300 000 km/s"},{"id":"D","text":"3 000 000 km/s"}]',
   '{"id":"C"}', true);

  -- Nauka – true_false
  insert into questions (type, category_id, difficulty, question_text, options, correct_answer, is_ranked_safe) values
  ('true_false', cat_nauka, 'easy',
   'Woda wrze w temperaturze 100°C przy normalnym ciśnieniu atmosferycznym.',
   '[{"id":"A","text":"Prawda"},{"id":"B","text":"Fałsz"}]',
   '{"id":"A"}', true),
  ('true_false', cat_nauka, 'medium',
   'DNA zbudowane jest z trzech nici.',
   '[{"id":"A","text":"Prawda"},{"id":"B","text":"Fałsz"}]',
   '{"id":"B"}', true);

  -- Geografia – single_choice
  insert into questions (type, category_id, difficulty, question_text, options, correct_answer, is_ranked_safe) values
  ('single_choice', cat_geografia, 'easy',
   'Jaką nazwę nosi najwyższy szczyt Afryki?',
   '[{"id":"A","text":"Kenia"},{"id":"B","text":"Atlas"},{"id":"C","text":"Kilimandżaro"},{"id":"D","text":"Karoo"}]',
   '{"id":"C"}', true),
  ('single_choice', cat_geografia, 'medium',
   'Które miasto jest stolicą Australii?',
   '[{"id":"A","text":"Sydney"},{"id":"B","text":"Melbourne"},{"id":"C","text":"Brisbane"},{"id":"D","text":"Canberra"}]',
   '{"id":"D"}', true),
  ('single_choice', cat_geografia, 'easy',
   'Przez ile kontynentów przepływa rzeka Amazonka?',
   '[{"id":"A","text":"1"},{"id":"B","text":"2"},{"id":"C","text":"3"},{"id":"D","text":"4"}]',
   '{"id":"A"}', true);

  -- Geografia – true_false
  insert into questions (type, category_id, difficulty, question_text, options, correct_answer, is_ranked_safe) values
  ('true_false', cat_geografia, 'easy',
   'Australia jest jednocześnie kontynentem i krajem.',
   '[{"id":"A","text":"Prawda"},{"id":"B","text":"Fałsz"}]',
   '{"id":"A"}', true),
  ('true_false', cat_geografia, 'medium',
   'Sahara to największa pustynia lodowa na świecie.',
   '[{"id":"A","text":"Prawda"},{"id":"B","text":"Fałsz"}]',
   '{"id":"B"}', true);

  -- Sport – single_choice
  insert into questions (type, category_id, difficulty, question_text, options, correct_answer, is_ranked_safe) values
  ('single_choice', cat_sport, 'easy',
   'Który kraj zorganizował pierwsze nowożytne Igrzyska Olimpijskie w 1896 roku?',
   '[{"id":"A","text":"Francja"},{"id":"B","text":"Wielka Brytania"},{"id":"C","text":"USA"},{"id":"D","text":"Grecja"}]',
   '{"id":"D"}', true),
  ('single_choice', cat_sport, 'medium',
   'Ile goli strzelił Ronaldo (R9) na Mistrzostwach Świata 2002?',
   '[{"id":"A","text":"6"},{"id":"B","text":"7"},{"id":"C","text":"8"},{"id":"D","text":"9"}]',
   '{"id":"C"}', true);

  -- Sport – true_false
  insert into questions (type, category_id, difficulty, question_text, options, correct_answer, is_ranked_safe) values
  ('true_false', cat_sport, 'easy',
   'Piłka nożna jest oficjalnie sportem olimpijskim od 1900 roku.',
   '[{"id":"A","text":"Prawda"},{"id":"B","text":"Fałsz"}]',
   '{"id":"A"}', true),
  ('true_false', cat_sport, 'medium',
   'Michael Jordan grał zawodowo w baseball.',
   '[{"id":"A","text":"Prawda"},{"id":"B","text":"Fałsz"}]',
   '{"id":"A"}', true);

  -- Technologia – single_choice
  insert into questions (type, category_id, difficulty, question_text, options, correct_answer, is_ranked_safe) values
  ('single_choice', cat_tech, 'easy',
   'W którym roku Apple zaprezentował pierwszego iPhone''a?',
   '[{"id":"A","text":"2005"},{"id":"B","text":"2006"},{"id":"C","text":"2007"},{"id":"D","text":"2008"}]',
   '{"id":"C"}', true),
  ('single_choice', cat_tech, 'medium',
   'Który język programowania stworzył Guido van Rossum?',
   '[{"id":"A","text":"Ruby"},{"id":"B","text":"Python"},{"id":"C","text":"PHP"},{"id":"D","text":"Perl"}]',
   '{"id":"B"}', true);

  -- Technologia – true_false
  insert into questions (type, category_id, difficulty, question_text, options, correct_answer, is_ranked_safe) values
  ('true_false', cat_tech, 'easy',
   'Linux jest systemem operacyjnym o otwartym kodzie źródłowym.',
   '[{"id":"A","text":"Prawda"},{"id":"B","text":"Fałsz"}]',
   '{"id":"A"}', true),
  ('true_false', cat_tech, 'medium',
   'JavaScript i Java to ten sam język programowania.',
   '[{"id":"A","text":"Prawda"},{"id":"B","text":"Fałsz"}]',
   '{"id":"B"}', true);

  -- Przyroda – single_choice
  insert into questions (type, category_id, difficulty, question_text, options, correct_answer, is_ranked_safe) values
  ('single_choice', cat_przyroda, 'easy',
   'Ile nóg ma pająk?',
   '[{"id":"A","text":"6"},{"id":"B","text":"8"},{"id":"C","text":"10"},{"id":"D","text":"12"}]',
   '{"id":"B"}', true),
  ('single_choice', cat_przyroda, 'medium',
   'Który ssak składa jaja?',
   '[{"id":"A","text":"Delfin"},{"id":"B","text":"Dziobak"},{"id":"C","text":"Kangur"},{"id":"D","text":"Foka"}]',
   '{"id":"B"}', true);

  -- Przyroda – true_false
  insert into questions (type, category_id, difficulty, question_text, options, correct_answer, is_ranked_safe) values
  ('true_false', cat_przyroda, 'easy',
   'Słoń jest największym lądowym ssakiem na Ziemi.',
   '[{"id":"A","text":"Prawda"},{"id":"B","text":"Fałsz"}]',
   '{"id":"A"}', true);

  -- Matematyka – single_choice
  insert into questions (type, category_id, difficulty, question_text, options, correct_answer, is_ranked_safe) values
  ('single_choice', cat_mat, 'easy',
   'Ile wynosi pierwiastek kwadratowy z 144?',
   '[{"id":"A","text":"11"},{"id":"B","text":"12"},{"id":"C","text":"13"},{"id":"D","text":"14"}]',
   '{"id":"B"}', true),
  ('single_choice', cat_mat, 'medium',
   'Ile stopni ma suma kątów wewnętrznych trójkąta?',
   '[{"id":"A","text":"90°"},{"id":"B","text":"180°"},{"id":"C","text":"270°"},{"id":"D","text":"360°"}]',
   '{"id":"B"}', true);

  -- Kultura i sztuka – single_choice
  insert into questions (type, category_id, difficulty, question_text, options, correct_answer, is_ranked_safe) values
  ('single_choice', cat_kultura, 'easy',
   'Kto napisał „Pana Tadeusza"?',
   '[{"id":"A","text":"Juliusz Słowacki"},{"id":"B","text":"Adam Mickiewicz"},{"id":"C","text":"Cyprian Kamil Norwid"},{"id":"D","text":"Henryk Sienkiewicz"}]',
   '{"id":"B"}', true),
  ('single_choice', cat_kultura, 'medium',
   'Który artysta namalował „Gwiaździstą noc"?',
   '[{"id":"A","text":"Claude Monet"},{"id":"B","text":"Pablo Picasso"},{"id":"C","text":"Vincent van Gogh"},{"id":"D","text":"Salvador Dalí"}]',
   '{"id":"C"}', true);

  -- Kultura i sztuka – true_false
  insert into questions (type, category_id, difficulty, question_text, options, correct_answer, is_ranked_safe) values
  ('true_false', cat_kultura, 'easy',
   'Leonardo da Vinci namalował „Monę Lisę".',
   '[{"id":"A","text":"Prawda"},{"id":"B","text":"Fałsz"}]',
   '{"id":"A"}', true);
end;
$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- get_server_time() — for client clock synchronisation
-- ─────────────────────────────────────────────────────────────────────────────
create or replace function get_server_time()
returns timestamptz
language sql
security definer
as $$
  select now();
$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- _execute_prepare_questions(p_room_id)
-- Internal helper: picks 12 questions from voted categories, saves to
-- room_questions, transitions room to 'question' (index 1, 15 s timer).
-- Idempotent: does nothing if room is not in profile_draft status.
-- ─────────────────────────────────────────────────────────────────────────────
create or replace function _execute_prepare_questions(p_room_id uuid)
returns void
language plpgsql
security definer
as $$
declare
  v_room         record;
  v_voted_cats   uuid[];
  v_question_ids uuid[];
  v_n            int;
  v_shuffled     uuid[];
  v_i            int;
  v_j            int;
  v_tmp          uuid;
  v_seed_float   float8;
begin
  select * into v_room from rooms where id = p_room_id;
  if v_room.status <> 'profile_draft' then return; end if;

  -- Get voted category IDs
  select array_agg(distinct category_id)
  into v_voted_cats
  from room_category_votes
  where room_id = p_room_id;

  -- Get enabled questions from voted categories
  if v_voted_cats is not null then
    select array_agg(id order by id)
    into v_question_ids
    from questions
    where is_enabled = true and category_id = any(v_voted_cats);
  end if;

  -- Fall back to all enabled questions if not enough
  if v_question_ids is null or array_length(v_question_ids, 1) < 12 then
    select array_agg(id order by id)
    into v_question_ids
    from questions
    where is_enabled = true;
  end if;

  v_n := array_length(v_question_ids, 1);
  if v_n is null or v_n < 12 then
    raise exception 'NOT_ENOUGH_QUESTIONS';
  end if;

  -- Deterministic Fisher-Yates shuffle seeded from room.seed
  v_seed_float := hashtext(v_room.seed || ':questions')::float8 / 2147483648.0;
  perform setseed(v_seed_float);

  v_shuffled := v_question_ids;
  for v_i in reverse v_n..2 loop
    v_j             := floor(random() * v_i)::int + 1;
    v_tmp           := v_shuffled[v_i];
    v_shuffled[v_i] := v_shuffled[v_j];
    v_shuffled[v_j] := v_tmp;
  end loop;

  -- Insert first 12
  for v_i in 1..12 loop
    insert into room_questions (room_id, question_id, question_index)
    values (p_room_id, v_shuffled[v_i], v_i)
    on conflict (room_id, question_index) do nothing;
  end loop;

  -- Transition to question phase
  update rooms
  set
    status                    = 'question',
    current_question_index    = 1,
    current_phase_started_at  = now(),
    current_phase_duration_ms = 15000
  where id = p_room_id;
end;
$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- Update select_profile to auto-advance when all players have selected
-- (replaces the version from migration 005)
-- ─────────────────────────────────────────────────────────────────────────────
create or replace function select_profile(p_room_id uuid, p_profile_id text)
returns void
language plpgsql
security definer
as $$
declare
  v_status         room_status;
  v_options        record;
  v_active_cnt     int;
  v_selected_cnt   int;
begin
  if auth.uid() is null then raise exception 'UNAUTHORIZED'; end if;

  select status into v_status from rooms where id = p_room_id;
  if not found then raise exception 'ROOM_NOT_FOUND'; end if;
  if v_status <> 'profile_draft' then raise exception 'WRONG_PHASE'; end if;

  if not exists (
    select 1 from room_players
    where room_id = p_room_id and user_id = auth.uid() and left_at is null
  ) then raise exception 'NOT_IN_ROOM'; end if;

  select * into v_options
  from room_profile_options
  where room_id = p_room_id and user_id = auth.uid();
  if not found then raise exception 'NO_OPTIONS'; end if;

  if p_profile_id != any(v_options.profile_ids) then
    raise exception 'INVALID_PROFILE';
  end if;

  update room_players
  set selected_profile_id = p_profile_id
  where room_id = p_room_id and user_id = auth.uid();

  -- Auto-advance when all active players have selected a profile
  select count(*) into v_active_cnt
  from room_players where room_id = p_room_id and left_at is null;

  select count(*) into v_selected_cnt
  from room_players
  where room_id = p_room_id and left_at is null and selected_profile_id is not null;

  if v_selected_cnt >= v_active_cnt then
    perform _execute_prepare_questions(p_room_id);
  end if;
end;
$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- prepare_questions(p_room_id)
-- Timeout fallback: any room member can call this to force-advance from
-- profile_draft → question when the timer expires.
-- ─────────────────────────────────────────────────────────────────────────────
create or replace function prepare_questions(p_room_id uuid)
returns void
language plpgsql
security definer
as $$
declare
  v_status room_status;
begin
  if auth.uid() is null then raise exception 'UNAUTHORIZED'; end if;

  select status into v_status from rooms where id = p_room_id;
  if not found then raise exception 'ROOM_NOT_FOUND'; end if;
  if v_status <> 'profile_draft' then return; end if;

  if not exists (
    select 1 from room_players
    where room_id = p_room_id and user_id = auth.uid() and left_at is null
  ) then raise exception 'NOT_IN_ROOM'; end if;

  -- Assign random profile to any player who hasn't chosen yet
  declare
    v_player      record;
    v_options     record;
    v_random_idx  int;
    v_random_prof text;
  begin
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
  end;

  perform _execute_prepare_questions(p_room_id);
end;
$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- submit_answer(p_room_id, p_question_index, p_answer)
-- Validates the answer, computes base score + speed bonus, records it, and
-- updates room_players.score + streak. Auto-advances to results when all
-- active players have answered.
-- Returns the breakdown JSON so the caller can display it immediately.
-- ─────────────────────────────────────────────────────────────────────────────
create or replace function submit_answer(
  p_room_id       uuid,
  p_question_index int,
  p_answer        jsonb
)
returns jsonb
language plpgsql
security definer
as $$
declare
  v_room         record;
  v_player       record;
  v_q            record;
  v_is_correct   boolean;
  v_elapsed_ms   int;
  v_response_ms  int;
  v_remaining_ms int;
  v_base         int;
  v_speed        int;
  v_total        int;
  v_breakdown    jsonb;
  v_lines        jsonb;
  v_active_cnt   int;
  v_answered_cnt int;
begin
  if auth.uid() is null then raise exception 'UNAUTHORIZED'; end if;

  select * into v_room from rooms where id = p_room_id;
  if not found then raise exception 'ROOM_NOT_FOUND'; end if;
  if v_room.status <> 'question' then raise exception 'WRONG_PHASE'; end if;
  if v_room.current_question_index <> p_question_index then raise exception 'WRONG_QUESTION'; end if;

  select * into v_player
  from room_players
  where room_id = p_room_id and user_id = auth.uid() and left_at is null;
  if not found then raise exception 'NOT_IN_ROOM'; end if;

  -- Grace: accept up to 1 s after timer ends
  v_elapsed_ms := (extract(epoch from now() - v_room.current_phase_started_at) * 1000)::int;
  if v_elapsed_ms > v_room.current_phase_duration_ms + 1000 then
    raise exception 'TIME_EXPIRED';
  end if;

  if exists (
    select 1 from answers
    where room_id = p_room_id and user_id = auth.uid() and question_index = p_question_index
  ) then
    raise exception 'ALREADY_ANSWERED';
  end if;

  -- Load question
  select q.type, q.correct_answer
  into v_q
  from room_questions rq
  join questions q on q.id = rq.question_id
  where rq.room_id = p_room_id and rq.question_index = p_question_index;
  if not found then raise exception 'QUESTION_NOT_FOUND'; end if;

  -- Correctness (single_choice + true_false use {"id": "X"})
  v_is_correct := (p_answer->>'id') = (v_q.correct_answer->>'id');

  -- Timing
  v_response_ms  := least(v_elapsed_ms, v_room.current_phase_duration_ms);
  v_remaining_ms := greatest(0, v_room.current_phase_duration_ms - v_response_ms);

  -- Scoring (Phase 6: base only, no profile/modification effects)
  if v_is_correct then
    v_base  := 100;
    v_speed := floor(50.0 * v_remaining_ms / v_room.current_phase_duration_ms)::int;
  else
    v_base  := -25;
    v_speed := 0;
  end if;

  v_total := v_base + v_speed;

  -- Build breakdown
  if v_is_correct then
    v_lines := jsonb_build_array(
      jsonb_build_object('label', '+100 poprawna odpowiedź', 'value', 100),
      jsonb_build_object('label', '+' || v_speed || ' szybkość',  'value', v_speed)
    );
  else
    v_lines := jsonb_build_array(
      jsonb_build_object('label', '-25 błędna odpowiedź', 'value', -25)
    );
  end if;

  v_breakdown := jsonb_build_object('lines', v_lines, 'total', v_total);

  -- Record answer
  insert into answers (
    room_id, user_id, question_index, question_id,
    answer, is_correct, response_ms,
    base_points, speed_bonus, flat_bonus, multiplier, penalty, total_points,
    breakdown
  )
  select
    p_room_id, auth.uid(), p_question_index, rq.question_id,
    p_answer, v_is_correct, v_response_ms,
    v_base, v_speed, 0, 1, 0, v_total,
    v_breakdown
  from room_questions rq
  where rq.room_id = p_room_id and rq.question_index = p_question_index;

  -- Update score and streak
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

  -- Auto-advance to results if all active players have answered
  select count(*) into v_active_cnt
  from room_players where room_id = p_room_id and left_at is null;

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

-- ─────────────────────────────────────────────────────────────────────────────
-- advance_room_phase(p_room_id)
-- Idempotent phase-transition driver. Called by any room member when:
--   - question timer expires  (question → results)
--   - results timer expires   (results → next question | finished)
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

    -- Advance only if all answered or time is up
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
    -- Wait for the 6 s results screen
    if v_elapsed_ms < v_room.current_phase_duration_ms then return; end if;

    if v_room.current_question_index >= 12 then
      update rooms
      set status = 'finished', finished_at = now()
      where id = p_room_id;
    else
      -- Phase 6: skip modification_draft, go straight to next question
      -- (Phase 7 will insert modification_draft transitions after q 3/6/9)
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
