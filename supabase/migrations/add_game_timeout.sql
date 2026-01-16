-- Add last_activity column to games table for timeout tracking
ALTER TABLE games
ADD COLUMN IF NOT EXISTS last_activity TIMESTAMP WITH TIME ZONE DEFAULT NOW();

-- Update existing games to have last_activity set to created_at
UPDATE games
SET last_activity = created_at
WHERE last_activity IS NULL;

-- Create index for efficient timeout queries
CREATE INDEX IF NOT EXISTS idx_games_last_activity ON games(last_activity) WHERE status = 'active';

-- Create function to auto-update last_activity on game moves
CREATE OR REPLACE FUNCTION update_game_activity()
RETURNS TRIGGER AS $$
BEGIN
    UPDATE games
    SET last_activity = NOW()
    WHERE id = NEW.game_id;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to update last_activity when moves are made
DROP TRIGGER IF EXISTS trigger_update_game_activity ON game_moves;
CREATE TRIGGER trigger_update_game_activity
AFTER INSERT ON game_moves
FOR EACH ROW
EXECUTE FUNCTION update_game_activity();

-- Create function to timeout stale games (24 hours)
CREATE OR REPLACE FUNCTION timeout_stale_games()
RETURNS void AS $$
DECLARE
    stale_game RECORD;
    winner_id UUID;
BEGIN
    FOR stale_game IN
        SELECT * FROM games
        WHERE status = 'active'
        AND last_activity < NOW() - INTERVAL '24 hours'
    LOOP
        -- Determine winner based on score
        IF stale_game.player1_score > stale_game.player2_score THEN
            winner_id := stale_game.player1_id;
        ELSIF stale_game.player2_score > stale_game.player1_score THEN
            winner_id := stale_game.player2_id;
        ELSE
            winner_id := NULL; -- Draw
        END IF;

        -- Update game status
        UPDATE games
        SET 
            status = 'finished',
            winner_id = winner_id,
            updated_at = NOW()
        WHERE id = stale_game.id;
    END LOOP;
END;
$$ LANGUAGE plpgsql;
