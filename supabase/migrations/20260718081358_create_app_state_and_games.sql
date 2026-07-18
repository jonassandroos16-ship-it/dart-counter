/*
# Create app_state and games tables (with per-mode support)

## Purpose
The dart-counter app stores shared data (players, settings, completed match
history) in Supabase so multiple users see the same data across devices. No
authentication is used — single-tenant, shared namespace.

This migration creates the base tables AND adds a generated `mode` column on
`games` so the stats view can split statistics per game mode (501, 301, 701,
101, Around the Clock, Practice, Killer, Speed 101, High Score). The mode is
nested inside the JSONB `data` column at `data->>'mode'`; exposing it as a
stored generated column makes per-mode filtering fast and ergonomic.

## Data flow
- In-progress matches (activeGame) stay in localStorage only.
- Player data and app settings sync to the `app_state` table.
- Completed match results sync to the `games` table — one row per game.

## New Tables

### app_state
Single-row table holding shared players and settings as JSONB.
- `id` (text, primary key, default 'main')
- `players` (jsonb, default '[]')
- `settings` (jsonb, default '{}')
- `updated_at` (timestamptz)

### games
One row per completed match record.
- `id` (text, primary key) — matches GameRecord.id
- `data` (jsonb) — full GameRecord object
- `mode` (text, generated, STORED) — equals `data->>'mode'`, auto-populated
- `created_at` (timestamptz)

## Security
- RLS enabled on both tables.
- Policies allow anon + authenticated full CRUD (TO anon, authenticated).
  Intentional: no login screen, anon-key client must read/write shared data.

## Notes
1. `GENERATED ALWAYS AS ... STORED` means `mode` cannot be written directly.
   The app writes only `{ id, data }`, so it is unaffected.
2. Index on `mode` supports fast per-mode SELECTs.
3. `IF NOT EXISTS` guards make this safe to re-run after a timeout.
*/

CREATE TABLE IF NOT EXISTS app_state (
  id text PRIMARY KEY DEFAULT 'main',
  players jsonb NOT NULL DEFAULT '[]'::jsonb,
  settings jsonb NOT NULL DEFAULT '{}'::jsonb,
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
