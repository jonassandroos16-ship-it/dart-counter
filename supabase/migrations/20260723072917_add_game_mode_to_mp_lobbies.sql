-- Add game_mode column to mp_lobbies so the host's chosen game mode
-- (dartboard or cards) is synced to all clients when they join.
ALTER TABLE mp_lobbies ADD COLUMN IF NOT EXISTS game_mode text NOT NULL DEFAULT 'dartboard';
