-- UPDATED SUBMIT GUESS V3 (With Word Progression & Normal Game End)
-- Adds logic to:
-- 1. Increment currentWordIndex on correct guess.
-- 2. Check if all words are finished -> specific 'finished' status.

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
    v_current_word_index INT;
    v_total_words INT;
BEGIN
    -- Get room
    SELECT * INTO v_room FROM rooms WHERE id = p_room_id;
    IF NOT FOUND THEN RAISE EXCEPTION 'Room not found'; END IF;

    v_current_turn := COALESCE((v_room.config->>'currentTurn')::INT, 0);
    v_current_word_index := COALESCE((v_room.game_state->>'currentWordIndex')::INT, 0);
    v_total_words := COALESCE(array_length(v_room.game_words, 1), 5); -- Fallback to 5

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

    -- 2. If correct
    IF p_is_correct THEN
        -- Increase Score
        UPDATE room_participants
        SET score = COALESCE(score, 0) + 100
        WHERE room_id = p_room_id AND user_id = p_user_id;

        -- Check if it was the LAST word?
        IF v_current_word_index + 1 >= v_total_words THEN
             
             -- CRITICAL FIX: Only finish room via RPC if Turn Based.
             -- For Word Race, wait for Trigger (check_room_completion).
             -- ROBUST CHECK: Check mode OR if turnOrder exists (implies turn-based)
             -- CRITICAL FIX: Only finish room via RPC if Turn Based.
             -- For Word Race, wait for Trigger (check_room_completion).
             -- ROBUST CHECK: Check mode OR if turnOrder exists (implies turn-based)
             IF v_room.game_mode = 'turn_based' OR (v_room.config->'turnOrder' IS NOT NULL AND jsonb_array_length(v_room.config->'turnOrder') > 0) THEN
                 -- GAME OVER (Normal End)
                 -- 1. Call Rewards Calculation FIRST (Handles status update to 'finished' and stats)
                 PERFORM award_room_rewards(p_room_id);

                 -- 2. Update Game State (Last Win) for UI feedback
                 UPDATE rooms SET
                    -- status = 'finished', -- Let award_room_rewards handle this!
                    game_state = jsonb_set(
                        jsonb_set(
                            game_state,
                            '{guesses}',
                            '[]'::jsonb
                        ),
                        '{lastWin}',
                        jsonb_build_object(
                             'userId', p_user_id,
                             'word', p_guess,
                             'score', 100,
                             'type', 'normal',
                             'timestamp', EXTRACT(EPOCH FROM NOW()) * 1000
                        )
                    )
                 WHERE id = p_room_id;
             ELSE
                 -- Just update LastWin/Clear Board, but KEEP status = 'playing'
                 UPDATE rooms SET
                    game_state = jsonb_set(
                        jsonb_set(
                            game_state,
                            '{guesses}',
                            '[]'::jsonb
                        ),
                        '{lastWin}',
                        jsonb_build_object(
                             'userId', p_user_id,
                             'word', p_guess,
                             'score', 100,
                             'type', 'normal',
                             'timestamp', EXTRACT(EPOCH FROM NOW()) * 1000
                        )
                    )
                 WHERE id = p_room_id;
             END IF;
             
             RETURN jsonb_build_object('success', true, 'gameFinished', true);
        ELSE
             -- NEXT WORD (Clear board + Increment Index)
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
                    '{currentWordIndex}',
                    to_jsonb(v_current_word_index + 1)
                )
             WHERE id = p_room_id;

             -- Also update lastWin for feedback
               UPDATE rooms SET
                game_state = jsonb_set(
                    game_state,
                    '{lastWin}',
                    jsonb_build_object(
                        'userId', p_user_id,
                        'word', p_guess,
                        'score', 100,
                        'type', 'round_win',
                        'timestamp', EXTRACT(EPOCH FROM NOW()) * 1000
                    )
                )
             WHERE id = p_room_id;
        END IF;
    END IF;

    -- 3. SMART TURN ADVANCEMENT (Skip inactive players)
    -- Even if word changed, we move to next player? usually yes in this logic
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
    -- Only update turn if game is NOT finished
    IF (v_current_word_index + 1 < v_total_words) OR (NOT p_is_correct) THEN
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
    END IF;

    RETURN jsonb_build_object('success', true, 'nextTurn', v_current_turn);
END;
$$;
