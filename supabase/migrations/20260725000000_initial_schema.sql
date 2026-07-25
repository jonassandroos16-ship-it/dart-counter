-- Full initial schema for dart-counter, consolidated from the project's
-- migration history. Applied to the new Supabase project on first setup.

CREATE TABLE IF NOT EXISTS app_state (
  id text PRIMARY KEY DEFAULT 'main',
  players jsonb NOT NULL DEFAULT '[]'::jsonb,
  settings jsonb NOT NULL DEFAULT '{}'::jsonb,
  deleted_player_ids text[] NOT NULL DEFAULT '{}'::text[],
  deleted_game_ids text[] NOT NULL DEFAULT '{}'::text[],
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE app_state ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_select_app_state" ON app_state;
CREATE POLICY "anon_select_app_state" ON app_state FOR SELECT
  TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "anon_insert_app_state" ON app_state;
CREATE POLICY "anon_insert_app_state" ON app_state FOR INSERT
  TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "anon_update_app_state" ON app_state;
CREATE POLICY "anon_update_app_state" ON app_state FOR UPDATE
  TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "anon_delete_app_state" ON app_state;
CREATE POLICY "anon_delete_app_state" ON app_state FOR DELETE
  TO anon, authenticated USING (true);

CREATE TABLE IF NOT EXISTS games (
  id text PRIMARY KEY,
  data jsonb NOT NULL,
  mode text GENERATED ALWAYS AS (data->>'mode') STORED,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE games ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_select_games" ON games;
CREATE POLICY "anon_select_games" ON games FOR SELECT
  TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "anon_insert_games" ON games;
CREATE POLICY "anon_insert_games" ON games FOR INSERT
  TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "anon_update_games" ON games;
CREATE POLICY "anon_update_games" ON games FOR UPDATE
  TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "anon_delete_games" ON games;
CREATE POLICY "anon_delete_games" ON games FOR DELETE
  TO anon, authenticated USING (true);

CREATE INDEX IF NOT EXISTS idx_games_mode ON games (mode);

CREATE TABLE IF NOT EXISTS campaign_progress (
  id text PRIMARY KEY DEFAULT 'main',
  data jsonb NOT NULL DEFAULT '{}'::jsonb,
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE campaign_progress ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_select_campaign_progress" ON campaign_progress;
CREATE POLICY "anon_select_campaign_progress" ON campaign_progress FOR SELECT
  TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "anon_insert_campaign_progress" ON campaign_progress;
CREATE POLICY "anon_insert_campaign_progress" ON campaign_progress FOR INSERT
  TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "anon_update_campaign_progress" ON campaign_progress;
CREATE POLICY "anon_update_campaign_progress" ON campaign_progress FOR UPDATE
  TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "anon_delete_campaign_progress" ON campaign_progress;
CREATE POLICY "anon_delete_campaign_progress" ON campaign_progress FOR DELETE
  TO anon, authenticated USING (true);

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
  input_mode text NOT NULL DEFAULT 'dartboard',
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
