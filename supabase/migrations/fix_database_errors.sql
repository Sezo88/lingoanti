-- Fix for missing game_mode in games table
ALTER TABLE games ADD COLUMN IF NOT EXISTS game_mode TEXT DEFAULT 'arena';

-- Fix for missing user1_id/user2_id in friendships table (referenced by a buggy trigger)
ALTER TABLE friendships ADD COLUMN IF NOT EXISTS user1_id UUID;
ALTER TABLE friendships ADD COLUMN IF NOT EXISTS user2_id UUID;
