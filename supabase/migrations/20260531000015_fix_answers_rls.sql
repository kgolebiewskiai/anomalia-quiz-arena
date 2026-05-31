-- Fix: answers RLS was "own row only", blocking:
--   1. loadAllAnswers (GET answers?room_id=...) — needed to show answer breakdown in results phase
--   2. Realtime INSERT subscription with room_id filter — needed for "Odpowiedziało: X/Y" counter
--
-- New policy: any player in the room can SELECT all answers for that room.
-- Writes (INSERT/UPDATE) remain restricted to own rows (done via RPC anyway).

drop policy if exists "answers: own row" on answers;
drop policy if exists "answers: read same room" on answers;
drop policy if exists "answers: own row write" on answers;

-- Read: all answers for rooms you're currently in
create policy "answers: read same room"
  on answers for select
  using (
    room_id in (select get_my_room_ids())
  );

-- Write: own rows only (actual inserts go through submit_answer RPC / security definer)
create policy "answers: own row write"
  on answers for all
  using (user_id = auth.uid())
  with check (user_id = auth.uid());
