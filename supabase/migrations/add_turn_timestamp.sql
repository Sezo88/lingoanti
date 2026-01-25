-- Add turn_started_at column to track when current turn began
ALTER TABLE games ADD COLUMN IF NOT EXISTS turn_started_at TIMESTAMPTZ DEFAULT NOW();

-- Update existing active games to set turn_started_at
UPDATE games 
SET turn_started_at = NOW() 
WHERE status = 'active' AND turn_started_at IS NULL;

-- Create function to check and auto-switch expired turns
CREATE OR REPLACE FUNCTION check_expired_turns()
RETURNS TABLE(game_id UUID, switched BOOLEAN) AS $$
DECLARE
    game_record RECORD;
    opponent_id UUID;
BEGIN
    -- Find all active games with duration > 0 where turn has expired
    FOR game_record IN
        SELECT id, player1_id, player2_id, current_turn, duration, turn_started_at
        FROM games
        WHERE status = 'active'
          AND duration > 0
          AND EXTRACT(EPOCH FROM (NOW() - turn_started_at)) > duration
    LOOP
        -- Determine opponent
        IF game_record.current_turn = game_record.player1_id THEN
            opponent_id := game_record.player2_id;
        ELSE
            opponent_id := game_record.player1_id;
        END IF;

        -- Switch turn and reset timer
        UPDATE games
        SET current_turn = opponent_id,
            turn_started_at = NOW()
        WHERE id = game_record.id;

        game_id := game_record.id;
        switched := TRUE;
        RETURN NEXT;
    END LOOP;
END;
$$ LANGUAGE plpgsql;

-- Update switchTurn to always reset turn_started_at
CREATE OR REPLACE FUNCTION switch_turn_with_timer(
    p_game_id UUID,
    p_next_player_id UUID
)
RETURNS VOID AS $$
BEGIN
    UPDATE games
    SET current_turn = p_next_player_id,
        turn_started_at = NOW()
    WHERE id = p_game_id;
END;
$$ LANGUAGE plpgsql;
