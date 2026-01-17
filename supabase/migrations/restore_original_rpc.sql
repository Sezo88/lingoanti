-- Restore original simple submit_turn_guess function
-- This matches the frontend at commit 2d3ffcb

DROP FUNCTION IF EXISTS submit_turn_guess(uuid,uuid,text,jsonb,boolean);

CREATE OR REPLACE FUNCTION submit_turn_guess(
    p_room_id UUID,
    p_user_id UUID,
    p_guess TEXT,
    p_result JSONB,
    p_is_correct BOOLEAN
)
RETURNS JSONB AS $$
DECLARE
    v_room RECORD;
    v_current_turn INT;
BEGIN
    -- Get room
    SELECT * INTO v_room FROM rooms WHERE id = p_room_id;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Room not found';
    END IF;

    -- Get current turn
    v_current_turn := COALESCE((v_room.config->>'currentTurn')::INT, 0);

    -- Add guess to shared state
    UPDATE rooms SET
        game_state = jsonb_set(
            jsonb_set(
                game_state,
                '{sharedGuesses}',
                COALESCE(game_state->'sharedGuesses', '[]'::jsonb) || to_jsonb(p_guess)
            ),
            '{sharedResults}',
            COALESCE(game_state->'sharedResults', '[]'::jsonb) || to_jsonb(p_result)
        )
    WHERE id = p_room_id;

    -- If correct, update score and clear guesses
    IF p_is_correct THEN
        UPDATE room_participants
        SET score = COALESCE(score, 0) + 100
        WHERE room_id = p_room_id AND user_id = p_user_id;
        
        -- Clear guesses for next round
        UPDATE rooms SET
            game_state = jsonb_set(
                jsonb_set(
                    game_state,
                    '{sharedGuesses}',
                    '[]'::jsonb
                ),
                '{sharedResults}',
                '[]'::jsonb
            )
        WHERE id = p_room_id;
    END IF;

    -- Move to next turn
    v_current_turn := v_current_turn + 1;

    -- Update turn and timestamp
    UPDATE rooms SET
        config = jsonb_set(
            jsonb_set(
                config,
                '{currentTurn}',
                to_jsonb(v_current_turn)
            ),
            '{turnStartTime}',
            to_jsonb(EXTRACT(EPOCH FROM NOW()) * 1000)
        )
    WHERE id = p_room_id;

    RETURN jsonb_build_object('success', true, 'nextTurn', v_current_turn);
END;
$$ LANGUAGE plpgsql;
