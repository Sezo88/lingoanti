CREATE OR REPLACE FUNCTION check_expired_turns()
RETURNS TABLE(game_id UUID, switched BOOLEAN) AS $$
DECLARE
    game_record RECORD;
    opponent_id UUID;
    v_move_number INTEGER;
    v_timeout_guess TEXT;
    v_result JSONB;
BEGIN
    -- Find all active games with duration > 0 where turn has expired
    -- Added word_length and current_round to selection
    FOR game_record IN
        SELECT id, player1_id, player2_id, current_turn, duration, turn_started_at, word_length, current_round
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

        -- Generate timeout guess (e.g. ?????)
        v_timeout_guess := REPEAT('?', game_record.word_length);
        
        -- Create dummy result (all invalid/absent)
        -- We construct a JSON array of objects like {"letter": "?", "status": "timeout"}
        -- Or just assume client handles it. Let's make it standard format but with status 'timeout' or 'absent'
        -- To be safe, let's use 'absent' (gray)
        
        -- Get next move number
        SELECT COALESCE(MAX(move_number), 0) + 1 INTO v_move_number
        FROM game_moves
        WHERE game_id = game_record.id AND round_number = game_record.current_round;

        -- Insert timeout move
        INSERT INTO game_moves (
            game_id,
            player_id,
            guess,
            result,
            move_number,
            round_number,
            created_at
        ) VALUES (
            game_record.id,
            game_record.current_turn,
            v_timeout_guess,
            '[]'::jsonb, -- Empty result or constructing it is hard in SQL. Client checks guess content?
            v_move_number,
            game_record.current_round,
            NOW()
        );

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
