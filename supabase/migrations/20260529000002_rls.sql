-- Enable RLS on all dynamic tables
alter table player_profiles enable row level security;
alter table rooms enable row level security;
alter table room_players enable row level security;
alter table room_category_votes enable row level security;
alter table room_questions enable row level security;
alter table room_profile_options enable row level security;
alter table room_modification_options enable row level security;
alter table player_modifications enable row level security;
alter table answers enable row level security;
alter table ratings enable row level security;

-- Static tables: public read-only via RLS
alter table profiles enable row level security;
alter table modifications enable row level security;
alter table anomalies enable row level security;
alter table categories enable row level security;
alter table questions enable row level security;

create policy "profiles: public read"    on profiles    for select using (true);
create policy "modifications: public read" on modifications for select using (true);
create policy "anomalies: public read"   on anomalies   for select using (true);
create policy "categories: public read"  on categories  for select using (true);
create policy "questions: public read"   on questions   for select using (true);

-- player_profiles: each user manages their own row
create policy "player_profiles: own row"
  on player_profiles for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- rooms: players in the room can read; host can insert
create policy "rooms: read if player"
  on rooms for select
  using (
    id in (
      select room_id from room_players where user_id = auth.uid()
    )
    or host_user_id = auth.uid()
  );

create policy "rooms: insert own"
  on rooms for insert
  with check (host_user_id = auth.uid());

-- room_players: read all players in rooms you're in; update only own row
create policy "room_players: read same room"
  on room_players for select
  using (
    room_id in (
      select room_id from room_players rp where rp.user_id = auth.uid()
    )
  );

create policy "room_players: insert own"
  on room_players for insert
  with check (user_id = auth.uid());

create policy "room_players: update own"
  on room_players for update
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- room_category_votes: own row
create policy "room_category_votes: own row"
  on room_category_votes for all
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- room_questions: read only active question (question_index <= current_question_index)
create policy "room_questions: read active"
  on room_questions for select
  using (
    room_id in (
      select room_id from room_players where user_id = auth.uid()
    )
    and question_index <= (
      select current_question_index from rooms r where r.id = room_id
    )
  );

-- room_profile_options: own row
create policy "room_profile_options: own row"
  on room_profile_options for all
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- room_modification_options: own row
create policy "room_modification_options: own row"
  on room_modification_options for all
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- player_modifications: own row (read-only; writes via RPC)
create policy "player_modifications: own row read"
  on player_modifications for select
  using (user_id = auth.uid());

-- answers: own row only; inserts via RPC
create policy "answers: own row"
  on answers for all
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- ratings: public read; own write
create policy "ratings: public read"
  on ratings for select
  using (true);

create policy "ratings: own write"
  on ratings for all
  using (user_id = auth.uid())
  with check (user_id = auth.uid());
