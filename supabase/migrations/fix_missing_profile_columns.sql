-- Add longest_win_streak column if it doesn't exist
ALTER TABLE users ADD COLUMN IF NOT EXISTS longest_win_streak INTEGER DEFAULT 0;

-- Ensure other commonly used stats exist just in case (defensive coding)
ALTER TABLE users ADD COLUMN IF NOT EXISTS total_wins INTEGER DEFAULT 0;
ALTER TABLE users ADD COLUMN IF NOT EXISTS total_losses INTEGER DEFAULT 0;
ALTER TABLE users ADD COLUMN IF NOT EXISTS total_games INTEGER DEFAULT 0;

-- Note: win_rate is calculated dynamically in the RPC, so no column needed.
