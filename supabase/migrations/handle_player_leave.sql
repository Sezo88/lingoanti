-- LEAVE ROOM LOGIC
-- Marks player as 'left' safely.
-- If it was their turn, calls skip_turn() immediately.

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
BEGIN
    v_user_id := auth.uid();
    
    -- 1. Update status to 'left'
    UPDATE room_participants 
    SET status = 'left' 
    WHERE room_id = p_room_id AND user_id = v_user_id;

    -- 2. Check if it was their turn
    SELECT * INTO v_room FROM rooms WHERE id = p_room_id;
    
    -- If room is playing, check turn order
    IF v_room.status = 'playing' THEN
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
