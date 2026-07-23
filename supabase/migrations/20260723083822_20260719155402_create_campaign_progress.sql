/*
# Create campaign_progress table (single-tenant, no auth)

## Purpose
The Co-op Campaign feature tracks the party's progress through the linear
campaign map. Only the player's progress is persisted as a single JSONB row.

## New Tables

### campaign_progress
Single-row table holding the party's campaign progress as JSONB.
- `id` (text, primary key, default 'main')
- `data` (jsonb) — CampaignProgress shape
- `updated_at` (timestamptz)

## Security
- RLS enabled on `campaign_progress`.
- Policies allow anon + authenticated full CRUD (TO anon, authenticated).
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
