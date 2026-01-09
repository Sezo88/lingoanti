-- Migration: Add Turn-Based Game Mode Support
-- Run this in Supabase SQL Editor

-- 1. Add game_mode column to rooms table
ALTER TABLE rooms 
ADD COLUMN IF NOT EXISTS game_mode TEXT NOT NULL DEFAULT 'arena' 
CHECK (game_mode IN ('arena', 'turn_based'));

-- 2. Add game_words column to rooms table (if not exists)
ALTER TABLE rooms 
ADD COLUMN IF NOT EXISTS game_words TEXT[];

-- 3. Update rooms config structure to support turn-based
-- This will preserve existing configs and add new fields
UPDATE rooms 
SET config = jsonb_set(
    jsonb_set(
        jsonb_set(
            jsonb_set(
                COALESCE(config, '{}'::jsonb),
                '{turnOrder}', '[]'::jsonb, true
            ),
            '{currentTurn}', '0'::jsonb, true
        ),
        '{roundsTotal}', '0'::jsonb, true
    ),
    '{currentRound}', '0'::jsonb, true
)
WHERE config IS NOT NULL OR config IS NULL;

-- 4. Add turn_score column to room_participants
ALTER TABLE room_participants 
ADD COLUMN IF NOT EXISTS turn_score INTEGER DEFAULT 0;

-- 5. Verify the changes
SELECT column_name, data_type, column_default 
FROM information_schema.columns 
WHERE table_name = 'rooms' 
AND column_name IN ('game_mode', 'game_words');

SELECT column_name, data_type, column_default 
FROM information_schema.columns 
WHERE table_name = 'room_participants' 
AND column_name = 'turn_score';
