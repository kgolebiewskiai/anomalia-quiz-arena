-- Fix infinite recursion in RLS policies.
-- The room_players policy queried room_players from within itself,
-- and the rooms policy queried room_players which triggered the same loop.
-- Solution: SECURITY DEFINER function bypasses RLS when evaluating the subquery.

create or replace function get_my_room_ids()
returns setof uuid
language sql
security definer
stable
set search_path = public
as $$
  select room_id from room_players where user_id = auth.uid() and left_at is null;
$$;

-- Rooms: drop old policy, recreate using function
drop policy if exists "rooms: read if player" on rooms;
create policy "rooms: read if player"
  on rooms for select
  using (
    id in (select get_my_room_ids())
    or host_user_id = auth.uid()
  );

-- room_players: drop old policy, recreate using function
drop policy if exists "room_players: read same room" on room_players;
create policy "room_players: read same room"
  on room_players for select
  using (
    room_id in (select get_my_room_ids())
  );
