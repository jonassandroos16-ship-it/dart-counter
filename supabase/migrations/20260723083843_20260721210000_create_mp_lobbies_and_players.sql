/*
# Create multiplayer lobby tables

## Purpose
The dart-counter multiplayer feature stores lobbies and lobby players in
Supabase so multiple devices can discover, join, and play games together in
realtime. No authentication is used — single-tenant, shared namespace.

## New Tables

### mp_lobbies
One row per lobby.
- `id` (uuid, primary key, default gen_random_uuid())
- `code` (text, not null) — 4-char human-shareable code
- `name` (text, not null) — lobby display name
- `host_device_id` (text, not null)
- `host_player_id` (text, not null)
- `status` (text, not null, default 'lobby')
- `game_config` (jsonb, nullable)
- `game_state` (jsonb, nullable)
- `popup_state` (jsonb, nullable)
- `player_turn` (int, not null, default 0)
- `game_mode` (text, not null, default 'dartboard')
- `created_at` (timestamptz, default now())
- `updated_at` (timestamptz, default now())

### mp_lobby_players
One row per player joined to a lobby.
- `id` (uuid, primary key, default gen_random_uuid())
- `lobby_id` (uuid, not null, references mp_lobbies(id) ON DELETE CASCADE)
- `device_id` (text, not null)
- `player_id` (text, not null)
- `player_name` (text, not null)
- `player_color` (text, not null)
- `ready` (boolean, not null, default false)
- `joined_at` (timestamptz, default now())
- Unique constraint on (lobby_id, player_id)

## Security
- RLS enabled on both tables.
- Policies allow anon + authenticated full CRUD (TO anon, authenticated).
- Both tables added to supabase_realtime publication for realtime subscriptions.
*/

CREATE TABLE IF NOT EXISTS mp_lobbies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL,
  name text NOT NULL,
  host_device_id text NOT NULL,
  host_player_id text NOT NULL,
  status text NOT NULL DEFAULT 'lobby',
  game_config jsonb,
  game_state jsonb,
  popup_state jsonb,
  player_turn integer NOT NULL DEFAULT 0,
  game_mode text NOT NULL DEFAULT 'dartboard',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE mp_lobbies ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_select_mp_lobbies" ON mp_lobbies;
CREATE POLICY "anon_select_mp_lobbies" ON mp_lobbies FOR SELECT
  TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "anon_insert_mp_lobbies" ON mp_lobbies;
CREATE POLICY "anon_insert_mp_lobbies" ON mp_lobbies FOR INSERT
  TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "anon_update_mp_lobbies" ON mp_lobbies;
CREATE POLICY "anon_update_mp_lobbies" ON mp_lobbies FOR UPDATE
  TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "anon_delete_mp_lobbies" ON mp_lobbies;
CREATE POLICY "anon_delete_mp_lobbies" ON mp_lobbies FOR DELETE
  TO anon, authenticated USING (true);

CREATE INDEX IF NOT EXISTS idx_mp_lobbies_code ON mp_lobbies (code);
CREATE INDEX IF NOT EXISTS idx_mp_lobbies_status ON mp_lobbies (status);

CREATE TABLE IF NOT EXISTS mp_lobby_players (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lobby_id uuid NOT NULL REFERENCES mp_lobbies(id) ON DELETE CASCADE,
  device_id text NOT NULL,
  player_id text NOT NULL,
  player_name text NOT NULL,
  player_color text NOT NULL,
  ready boolean NOT NULL DEFAULT false,
  joined_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT mp_lobby_players_lobby_player_unique UNIQUE (lobby_id, player_id)
);

ALTER TABLE mp_lobby_players ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_select_mp_lobby_players" ON mp_lobby_players;
CREATE POLICY "anon_select_mp_lobby_players" ON mp_lobby_players FOR SELECT
  TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "anon_insert_mp_lobby_players" ON mp_lobby_players;
CREATE POLICY "anon_insert_mp_lobby_players" ON mp_lobby_players FOR INSERT
  TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "anon_update_mp_lobby_players" ON mp_lobby_players;
CREATE POLICY "anon_update_mp_lobby_players" ON mp_lobby_players FOR UPDATE
  TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "anon_delete_mp_lobby_players" ON mp_lobby_players;
CREATE POLICY "anon_delete_mp_lobby_players" ON mp_lobby_players FOR DELETE
  TO anon, authenticated USING (true);

CREATE INDEX IF NOT EXISTS idx_mp_lobby_players_lobby_id ON mp_lobby_players (lobby_id);

-- Add both tables to the realtime publication
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND tablename = 'mp_lobbies'
      AND schemaname = 'public'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.mp_lobbies;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND tablename = 'mp_lobby_players'
      AND schemaname = 'public'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.mp_lobby_players;
  END IF;
END $$;
