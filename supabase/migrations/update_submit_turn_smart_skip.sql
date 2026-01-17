-- UPDATED SUBMIT GUESS WITH SMART SKIP
-- Based on GOLDEN backup, but adds the loop to skip inactive players after a guess.

DROP FUNCTION IF EXISTS submit_turn_guess(uuid,uuid,text,jsonb,boolean);

CREATE OR REPLACE FUNCTION submit_turn_guess(
    p_room_id UUID,
    p_user_id UUID,
    p_guess TEXT,
    p_result JSONB,
    p_is_correct BOOLEAN
)
RETURNS JSONB 
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_room RECORD;
    v_current_turn INT;
    v_turn_order JSONB;
    v_max_players INT;
    v_next_turn_index INT;
    v_next_player_id UUID;
    v_next_player_status participant_status;
    v_loop_count INT := 0;
BEGIN
    -- Get room
    SELECT * INTO v_room FROM rooms WHERE id = p_room_id;
    IF NOT FOUND THEN RAISE EXCEPTION 'Room not found'; END IF;

    v_current_turn := COALESCE((v_room.config->>'currentTurn')::INT, 0);

    -- 1. Add guess and result (Nested Array Logic)
    UPDATE rooms SET
        game_state = jsonb_set(
            jsonb_set(
                game_state,
                '{guesses}',
                COALESCE(game_state->'guesses', '[]'::jsonb) || jsonb_build_array(p_guess)
            ),
            '{results}',
            COALESCE(game_state->'results', '[]'::jsonb) || jsonb_build_array(p_result)
        )
    WHERE id = p_room_id;

    -- 2. If correct, update score (and mark win / clear board)
    IF p_is_correct THEN
        UPDATE room_participants
        SET score = COALESCE(score, 0) + 100
        WHERE room_id = p_room_id AND user_id = p_user_id;
        
        UPDATE rooms SET
            game_state = jsonb_set(
                jsonb_set(
                    jsonb_set(
                        game_state,
                        '{guesses}',
                        '[]'::jsonb
                    ),
                    '{results}',
                    '[]'::jsonb
                ),
                '{lastWin}',
                jsonb_build_object(
                    'userId', p_user_id,
                    'word', p_guess,
                    'score', 100,
                    'timestamp', EXTRACT(EPOCH FROM NOW()) * 1000
                )
            )
        WHERE id = p_room_id;
    END IF;

    -- 3. SMART TURN ADVANCEMENT (Skip inactive players)
    v_turn_order := v_room.config->'turnOrder';
    v_max_players := jsonb_array_length(v_turn_order);

    LOOP
        v_current_turn := v_current_turn + 1;
        v_loop_count := v_loop_count + 1;

        -- Prevent infinite loop
        IF v_loop_count > v_max_players THEN EXIT; END IF;

        v_next_turn_index := v_current_turn % v_max_players;
        v_next_player_id := (v_turn_order->>v_next_turn_index)::UUID;

        SELECT status INTO v_next_player_status 
        FROM room_participants 
        WHERE room_id = p_room_id AND user_id = v_next_player_id;

        -- Found active player?
        IF v_next_player_status IS NULL OR v_next_player_status IN ('active', 'playing', 'ready') THEN
            EXIT; 
        END IF;
    END LOOP;

    -- 4. Update room config
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
$$;
