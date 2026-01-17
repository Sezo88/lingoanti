-- SKIP TURN LOGIC (Smart Skip)
-- Advances the turn to the next "active" or "playing" or "ready" player.
-- Skips "left" and "disconnected" players.

CREATE OR REPLACE FUNCTION skip_turn(p_room_id UUID)
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
    -- Get room details
    SELECT * INTO v_room FROM rooms WHERE id = p_room_id;
    IF NOT FOUND THEN RAISE EXCEPTION 'Room not found'; END IF;

    v_current_turn := COALESCE((v_room.config->>'currentTurn')::INT, 0);
    v_turn_order := v_room.config->'turnOrder';
    v_max_players := jsonb_array_length(v_turn_order);

    IF v_max_players = 0 THEN
        RETURN jsonb_build_object('success', false, 'message', 'No players');
    END IF;

    -- Loop to find next active player
    LOOP
        v_current_turn := v_current_turn + 1;
        v_loop_count := v_loop_count + 1;

        -- Prevent infinite loop if everyone left (stop after checking everyone once)
        IF v_loop_count > v_max_players THEN
             EXIT;
        END IF;

        -- Calculate which player is next in the array
        v_next_turn_index := v_current_turn % v_max_players;
        v_next_player_id := (v_turn_order->>v_next_turn_index)::UUID;

        -- Check status of that player
        SELECT status INTO v_next_player_status 
        FROM room_participants 
        WHERE room_id = p_room_id AND user_id = v_next_player_id;

        -- If player is present, break the loop (they obtain the turn)
        -- We treat NULL status as active (legacy support)
        IF v_next_player_status IS NULL OR v_next_player_status IN ('active', 'playing', 'ready') THEN
            EXIT; 
        END IF;
        
        -- If 'left' or 'disconnected', loop continues to next number
    END LOOP;

    -- Update room config with new turn and reset timer
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
