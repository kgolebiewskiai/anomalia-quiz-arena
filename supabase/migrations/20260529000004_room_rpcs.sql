-- Enable Realtime on rooms and room_players
alter publication supabase_realtime add table rooms;
alter publication supabase_realtime add table room_players;

-- Helper: generate a unique 6-char uppercase alphanumeric room code
create or replace function generate_room_code()
returns text
language plpgsql
as $$
declare
  v_code text;
  v_chars text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; -- no O/0, I/1 to avoid confusion
  v_i int;
begin
  loop
    v_code := '';
    for v_i in 1..6 loop
      v_code := v_code || substr(v_chars, floor(random() * length(v_chars) + 1)::int, 1);
    end loop;
    exit when not exists (select 1 from rooms where code = v_code);
  end loop;
  return v_code;
end;
$$;

-- create_room(mode, max_players) → {room_id, code}
-- Creates a room and adds the calling user as host (slot 1).
create or replace function create_room(
  p_mode room_mode,
  p_max_players int default 8
)
returns json
language plpgsql
security definer
as $$
declare
  v_room_id uuid;
  v_code text;
  v_display_name text;
begin
  if auth.uid() is null then
    raise exception 'UNAUTHORIZED';
  end if;

  if p_max_players < 2 or p_max_players > 8 then
    raise exception 'INVALID_MAX_PLAYERS';
  end if;

  v_code := generate_room_code();

  insert into rooms (code, mode, host_user_id, seed, max_players)
  values (v_code, p_mode, auth.uid(), gen_random_uuid()::text, p_max_players)
  returning id into v_room_id;

  select display_name into v_display_name
  from player_profiles
  where user_id = auth.uid();

  if v_display_name is null then
    v_display_name := 'Uczestnik';
  end if;

  insert into room_players (room_id, user_id, display_name, slot)
  values (v_room_id, auth.uid(), v_display_name, 1);

  return json_build_object('room_id', v_room_id, 'code', v_code);
end;
$$;

-- join_room(code) → {room_id, code, slot}
-- Adds the calling user to an existing lobby room, or returns existing slot.
create or replace function join_room(p_code text)
returns json
language plpgsql
security definer
as $$
declare
  v_room record;
  v_player_count int;
  v_slot int;
  v_display_name text;
  v_existing record;
begin
  if auth.uid() is null then
    raise exception 'UNAUTHORIZED';
  end if;

  select * into v_room from rooms where code = upper(trim(p_code));

  if not found then
    raise exception 'ROOM_NOT_FOUND';
  end if;

  if v_room.status <> 'lobby' then
    raise exception 'ROOM_NOT_IN_LOBBY';
  end if;

  -- If already in room (and not left), return current slot
  select * into v_existing
  from room_players
  where room_id = v_room.id and user_id = auth.uid() and left_at is null;

  if found then
    return json_build_object('room_id', v_room.id, 'code', v_room.code, 'slot', v_existing.slot);
  end if;

  select count(*) into v_player_count
  from room_players
  where room_id = v_room.id and left_at is null;

  if v_player_count >= v_room.max_players then
    raise exception 'ROOM_FULL';
  end if;

  -- Find lowest available slot
  select min(s) into v_slot
  from generate_series(1, v_room.max_players) s
  where s not in (
    select slot from room_players where room_id = v_room.id and left_at is null
  );

  select display_name into v_display_name
  from player_profiles
  where user_id = auth.uid();

  if v_display_name is null then
    v_display_name := 'Uczestnik';
  end if;

  insert into room_players (room_id, user_id, display_name, slot)
  values (v_room.id, auth.uid(), v_display_name, v_slot);

  return json_build_object('room_id', v_room.id, 'code', v_room.code, 'slot', v_slot);
end;
$$;

-- Additional RLS: allow reading a room by code before joining (for join flow preview)
create policy "rooms: read by code (pre-join)"
  on rooms for select
  using (status = 'lobby');
