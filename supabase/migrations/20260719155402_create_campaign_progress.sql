/*
# Create campaign_progress table (single-tenant, no auth)

## Purpose
The Co-op Campaign feature tracks the party's progress through the linear
campaign map. To minimize database space, the entire campaign structure
(levels, enemy stats, shields) is defined in static JSON config files
shipped with the app. Only the player's progress — a single integer for
the highest level beaten, plus the party's current/max HP — is persisted.

## Data flow
- Static content lives in `src/campaign/campaignLevels.ts` and
  `src/campaign/enemyDatabase.ts` (editable via the in-app Campaign Editor).
- Runtime progress lives in this `campaign_progress` table as a single JSONB
  row keyed by `id = 'main'`, mirroring the existing `app_state` pattern.
- The frontend also mirrors progress to localStorage for offline-first UX;
  Supabase is the source of truth for cross-device sync.

## New Tables

### campaign_progress
Single-row table holding the party's campaign progress as JSONB.
- `id` (text, primary key, default 'main')
- `data` (jsonb) — CampaignProgress shape:
  { highest_level_beaten: int, current_party_hp: int, party_max_hp: int }
- `updated_at` (timestamptz)

## Security
- RLS enabled on `campaign_progress`.
- Policies allow anon + authenticated full CRUD (TO anon, authenticated).
  Intentional: no login screen, anon-key client must read/write shared data.
  This mirrors the existing `app_state` and `games` policy pattern.

## Notes
1. `IF NOT EXISTS` guards make this safe to re-run after a timeout.
2. The table is intentionally a single shared row — the app is single-tenant
   with no sign-in, so all users share the same campaign state.
3. Tombstones are not needed here because progress is a single upserted row,
   not an append-only collection like games/players.
*/

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
