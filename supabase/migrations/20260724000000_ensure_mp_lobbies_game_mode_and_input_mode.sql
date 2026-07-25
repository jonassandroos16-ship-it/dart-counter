/*
# Ensure game_mode and input_mode columns on mp_lobbies

## Purpose
Convergence migration. Several earlier migrations create or alter
`mp_lobbies` in overlapping ways, and some environments ended up with the
table created by the duplicate `20260723083843` migration (which bakes in
`game_mode` but omits `input_mode`) while the `20260723194019` migration
that adds `input_mode` either timed out or was marked applied without
running. The result: `mp_lobbies.input_mode` is missing, `createLobby()`
in `src/multiplayer/client.ts` fails its insert, returns null, and the UI
shows "Could not create lobby" even though every other feature works.

## Changes
- `ALTER TABLE ... ADD COLUMN IF NOT EXISTS` for both `game_mode` and
  `input_mode`, each `text NOT NULL DEFAULT 'dartboard'`. Idempotent and
  safe on environments that already have either or both columns.

## Security
- No RLS policy changes. Existing anon/authenticated CRUD policies on
  `mp_lobbies` already cover these columns.

## Notes
1. `IF NOT EXISTS` makes this safe to re-run.
2. No data loss — existing rows keep their values; rows that predate the
   column get the default 'dartboard'.
*/

ALTER TABLE mp_lobbies
  ADD COLUMN IF NOT EXISTS game_mode text NOT NULL DEFAULT 'dartboard';

ALTER TABLE mp_lobbies
  ADD COLUMN IF NOT EXISTS input_mode text NOT NULL DEFAULT 'dartboard';
