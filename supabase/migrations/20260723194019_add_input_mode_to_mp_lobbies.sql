/*
# Add input_mode column to mp_lobbies

## Purpose
Separates the input method (dartboard vs cards) from the game type
(dartboard, cards, coop, dartlite) so that Coop and Dartlite modes can
independently specify which input style the players use.

## Changes
- Adds `input_mode` column (text, NOT NULL, default 'dartboard') to
  `mp_lobbies`. Values: 'dartboard' | 'cards'.
- The existing `game_mode` column continues to store the game type
  ('dartboard' | 'cards' | 'coop' | 'dartlite').

## Security
- No RLS policy changes. Existing anon/authenticated CRUD policies on
  `mp_lobbies` already cover the new column (full UPDATE access).

## Notes
1. `IF NOT EXISTS` guard makes this safe to re-run after a timeout.
2. No data loss — existing rows get the default 'dartboard' value.
*/

ALTER TABLE mp_lobbies ADD COLUMN IF NOT EXISTS input_mode text NOT NULL DEFAULT 'dartboard';
