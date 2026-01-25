-- Revert create_matchmaking_function to correct state (Active + Turn Init)
CREATE OR REPLACE FUNCTION find_match(p_user_id UUID)
RETURNS UUID AS $$
DECLARE
    v_match_id UUID;
    v_opponent_id UUID;
    v_game_id UUID;
    v_room_id UUID;
    v_queue_record RECORD;
    v_initial_word TEXT;
BEGIN
    -- 1. Check if user is already in queue
    DELETE FROM matchmaking_queue WHERE user_id = p_user_id;

    -- 2. Look for an opponent in the queue
    -- Lock the row to prevent race conditions
    SELECT * INTO v_queue_record
    FROM matchmaking_queue
    WHERE user_id != p_user_id
    ORDER BY created_at ASC
    LIMIT 1
    FOR UPDATE SKIP LOCKED;

    IF v_queue_record.user_id IS NOT NULL THEN
        v_opponent_id := v_queue_record.user_id;

        -- 3. Match found! Remove opponent from queue
        DELETE FROM matchmaking_queue WHERE user_id = v_opponent_id;

        -- Select initial word for the legacy games table (Mixed Mode: 4-7 letters)
        SELECT word INTO v_initial_word FROM words WHERE length BETWEEN 4 AND 7 ORDER BY RANDOM() LIMIT 1;

        IF v_initial_word IS NULL THEN
            -- Fallback if table is empty (should not happen in prod)
            v_initial_word := 'START'; 
        END IF;

        -- 4. Create a new Game (legacy games table for Arena history/tracking if needed)
        -- FIX: Use 'active' status and initialize turn/round + Duration 60s
        INSERT INTO games (player1_id, player2_id, status, best_of, word_length, target_word, mixed_mode, current_turn, current_round, duration)
        VALUES (v_opponent_id, p_user_id, 'active', 3, length(v_initial_word), v_initial_word, true, v_opponent_id, 1, 60)
        RETURNING id INTO v_game_id;

        -- 5. Create a ROOM for the actual gameplay (Arena Mode)
        -- CRITICAL: Set wordCount to 3 for Best of 3!
        INSERT INTO rooms (
            host_id, 
            status, 
            game_mode, 
            game_words, -- Will be populated by trigger or start_room_game
            config
        )
        VALUES (
            v_opponent_id, -- One of them is host
            'playing',
            'arena',
            (SELECT ARRAY(SELECT word FROM words WHERE length = 5 ORDER BY RANDOM() LIMIT 3)), -- Pre-fill 3 words
            jsonb_build_object(
                'isPublic', false,
                'maxPlayers', 2,
                'wordCount', 3, -- Explicitly 3
                'wordLength', 5,
                'duration', 90, -- Little more time for 3 words? or per word? Usually per game.
                'gameMode', 'arena',
                'roundsTotal', 3
            )
        )
        RETURNING id INTO v_room_id;

        -- 6. Add both players to the room
        INSERT INTO room_participants (room_id, user_id, status)
        VALUES 
            (v_room_id, v_opponent_id, 'playing'),
            (v_room_id, p_user_id, 'playing');

        RETURN v_game_id;
    ELSE
        -- No opponent found, add to queue
        INSERT INTO matchmaking_queue (user_id) VALUES (p_user_id);
        RETURN NULL;
    END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
