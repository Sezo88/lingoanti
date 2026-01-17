-- LEAVE ROOM LOGIC V2 (Last Man Standing)
-- 1. Marks player as 'left'.
-- 2. Checks if only 1 active player remains -> Automatic Win.
-- 3. If game continues and it was leaver's turn -> Calls skip_turn().

CREATE OR REPLACE FUNCTION leave_room(p_room_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_user_id UUID;
    v_room RECORD;
    v_current_turn_index INT;
    v_turn_order JSONB;
    v_current_player_id UUID;
    v_active_count INT;
    v_survivor_id UUID;
    v_survivor_name TEXT;
BEGIN
    v_user_id := auth.uid();
    
    -- 1. Update status to 'left'
    UPDATE room_participants 
    SET status = 'left' 
    WHERE room_id = p_room_id AND user_id = v_user_id;

    -- 2. Check remaining active players (Last Man Standing)
    SELECT COUNT(*), MAX(user_id) INTO v_active_count, v_survivor_id
    FROM room_participants
    WHERE room_id = p_room_id 
    AND status IN ('active', 'playing', 'ready', 'connected'); -- Legacy compatibility

    SELECT * INTO v_room FROM rooms WHERE id = p_room_id;

    -- If only 1 player remains and game is playing
    IF v_active_count = 1 AND v_room.status = 'playing' THEN
        
        -- Award Survivor Bonus (+500)
        UPDATE room_participants
        SET score = COALESCE(score, 0) + 500
        WHERE room_id = p_room_id AND user_id = v_survivor_id;

        -- Finish Game & Notify
        UPDATE rooms SET
            status = 'finished',
            game_state = jsonb_set(
                v_room.game_state,
                '{lastWin}',
                jsonb_build_object(
                    'userId', v_survivor_id,
                    'word', 'SON KALAN', -- Special wrapper
                    'score', 500,
                    'type', 'survivor',
                    'timestamp', EXTRACT(EPOCH FROM NOW()) * 1000
                )
            )
        WHERE id = p_room_id;

        RETURN jsonb_build_object('success', true, 'message', 'Game Over - Last Man Standing');
    
    -- 3. Game continues: Handle Turn Skipping
    ELSIF v_room.status = 'playing' THEN
        v_turn_order := v_room.config->'turnOrder';
        
        IF v_turn_order IS NOT NULL AND jsonb_array_length(v_turn_order) > 0 THEN
            v_current_turn_index := COALESCE((v_room.config->>'currentTurn')::INT, 0) % jsonb_array_length(v_turn_order);
            v_current_player_id := (v_turn_order->>v_current_turn_index)::UUID;

            -- If the leaver currently has the turn, skip immediately!
            IF v_current_player_id = v_user_id THEN
                PERFORM skip_turn(p_room_id);
            END IF;
        END IF;
    END IF;

    RETURN jsonb_build_object('success', true);
END;
$$;
