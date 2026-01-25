DROP FUNCTION IF EXISTS check_expired_turns();

CREATE OR REPLACE FUNCTION check_expired_turns()
RETURNS TABLE(out_game_id UUID, switched BOOLEAN, error_msg TEXT) AS $$
DECLARE
    game_record RECORD;
    opponent_id UUID;
    v_move_number INTEGER;
    v_timeout_guess TEXT;
    v_result JSONB;
BEGIN
    FOR game_record IN
        SELECT id, player1_id, player2_id, current_turn, duration, turn_started_at, word_length, current_round, target_word
        FROM games
        WHERE status = 'active'
          AND duration > 0
          AND EXTRACT(EPOCH FROM (NOW() - turn_started_at)) >= duration
    LOOP
        BEGIN
            -- Determine opponent
            IF game_record.current_turn = game_record.player1_id THEN
                opponent_id := game_record.player2_id;
            ELSE
                opponent_id := game_record.player1_id;
            END IF;

            v_timeout_guess := REPEAT('?', game_record.word_length);
            
            -- Generate properly formatted result JSON (INVALID = RED)
            SELECT jsonb_agg(
                jsonb_build_object(
                    'letter', '?',
                    'status', 'invalid'
                )
            )
            INTO v_result
            FROM generate_series(1, game_record.word_length);
            
            -- Get next move number
            SELECT COALESCE(MAX(gm.move_number), 0) + 1 INTO v_move_number
            FROM game_moves gm
            WHERE gm.game_id = game_record.id AND gm.round_number = game_record.current_round;

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
                v_result,
                v_move_number,
                game_record.current_round,
                NOW()
            );

            -- Check MAX ATTEMPTS (6)
            IF v_move_number >= 6 THEN
                -- Round Over -> Trigger Client Modal via round_message
                -- DRAW|TARGET_WORD format
                UPDATE games
                SET round_message = 'DRAW|' || game_record.target_word,
                    turn_started_at = NULL -- Stop timer
                WHERE id = game_record.id;
                
                switched := TRUE;
            ELSE
                -- Normal turn switch
                UPDATE games
                SET current_turn = opponent_id,
                    turn_started_at = NOW()
                WHERE id = game_record.id;
                
                switched := TRUE;
            END IF;

            out_game_id := game_record.id;
            switched := TRUE;
            error_msg := NULL;
            RETURN NEXT;
        EXCEPTION WHEN OTHERS THEN
            out_game_id := game_record.id;
            switched := FALSE;
            error_msg := SQLERRM;
            RETURN NEXT;
        END;
    END LOOP;
END;
$$ LANGUAGE plpgsql;
