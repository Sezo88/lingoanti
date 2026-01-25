-- Fix for "record new has no field game_mode" error
-- A trigger is trying to access game_mode on games table, but it doesn't exist.
-- Adding the column satisfies the trigger.

ALTER TABLE games ADD COLUMN IF NOT EXISTS game_mode TEXT DEFAULT 'arena';
