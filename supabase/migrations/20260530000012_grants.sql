-- Explicit grants required for hosted Supabase.
-- Local dev auto-grants these; hosted cloud does not since 2026-05-30.

grant usage on schema public to anon, authenticated;

-- Static tables: public read
grant select on profiles, modifications, anomalies, categories, questions
  to anon, authenticated;

-- Dynamic tables: authenticated users read
grant select on
  rooms,
  room_players,
  room_category_votes,
  room_questions,
  room_profile_options,
  room_modification_options,
  player_modifications,
  player_profiles,
  answers,
  ratings,
  matchmaking_queue
  to authenticated;

-- anon can read lobby rooms (needed for join flow before auth completes)
grant select on rooms to anon;

-- player_profiles: own row update (display name change)
grant update on player_profiles to authenticated;
