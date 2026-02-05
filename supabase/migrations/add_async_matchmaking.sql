-- 1. Add 'mode' column to matchmaking_queue
CREATE TABLE IF NOT EXISTS matchmaking_queue (
    user_id UUID PRIMARY KEY REFERENCES users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

DO $$ 
BEGIN 
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'matchmaking_queue' AND column_name = 'mode') THEN 
        ALTER TABLE matchmaking_queue ADD COLUMN mode TEXT DEFAULT 'quick'; 
    END IF; 
END $$;

-- 2. Create RPC to Cancel Matchmaking AND Refund Heart
CREATE OR REPLACE FUNCTION cancel_matchmaking(p_user_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
    v_deleted BOOLEAN;
BEGIN
    -- Delete from queue
    DELETE FROM matchmaking_queue WHERE user_id = p_user_id;
    
    -- Refund Heart (Increment in user_currency table)
    UPDATE user_currency 
    SET hearts = hearts + 1 
    WHERE user_id = p_user_id;

    RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. Update find_match to support Modes and 'Already Queued' check AND ATOMIC DEDUCTION
CREATE OR REPLACE FUNCTION find_match(p_user_id UUID, p_mode TEXT DEFAULT 'quick')
RETURNS UUID AS $$
DECLARE
    v_hearts INT;
    v_match_id UUID;
    v_opponent_id UUID;
    v_game_id UUID;
    v_room_id UUID;
    v_game_mode TEXT;
    v_duration INT;
    v_queue_record RECORD;
    v_initial_word TEXT;
BEGIN
    -- 0. ATOMIC PAYMENT CHECK & DEDUCTION
    SELECT hearts INTO v_hearts FROM user_currency WHERE user_id = p_user_id;
    
    IF v_hearts IS NULL OR v_hearts < 1 THEN
        RAISE EXCEPTION 'INSUFFICIENT_FUNDS';
    END IF;

    -- Deduct 1 Heart
    UPDATE user_currency SET hearts = hearts - 1 WHERE user_id = p_user_id;

    -- Determine Game Settings based on Mode
    IF p_mode = 'async' THEN
        v_game_mode := 'turn_based';
        v_duration := 0; -- No timer
    ELSE
        v_game_mode := 'quick';
        v_duration := 60;
    END IF;

    -- NEW FEATURE: Check if user is ALREADY in Async Queue
    -- If Async mode, prevent resetting queue position or duplicate lookup
    IF p_mode = 'async' AND EXISTS (SELECT 1 FROM matchmaking_queue WHERE user_id = p_user_id) THEN
        -- Raise specific exception.
        -- CRITICAL: This exception triggers ROLLBACK, so the heart deduction above is UNDONE automatically.
        RAISE EXCEPTION 'ALREADY_QUEUED';
    END IF;

    -- 1. Check if user is already in queue (clean up old entries)
    DELETE FROM matchmaking_queue WHERE user_id = p_user_id;

    -- 2. Look for an opponent in the queue with SAME MODE
    SELECT * INTO v_queue_record
    FROM matchmaking_queue
    WHERE user_id != p_user_id
    AND mode = p_mode -- Strict mode matching
    ORDER BY created_at ASC
    LIMIT 1
    FOR UPDATE SKIP LOCKED;

    IF v_queue_record.user_id IS NOT NULL THEN
        v_opponent_id := v_queue_record.user_id;

        -- 3. Match found! Remove opponent from queue
        DELETE FROM matchmaking_queue WHERE user_id = v_opponent_id;

        -- Select initial word
        SELECT word INTO v_initial_word FROM words WHERE length BETWEEN 4 AND 7 ORDER BY RANDOM() LIMIT 1;
        IF v_initial_word IS NULL THEN v_initial_word := 'START'; END IF;

        -- 4. Create Game
        INSERT INTO games (
            player1_id, player2_id, status, best_of, 
            word_length, target_word, mixed_mode, 
            current_turn, current_round, duration, game_mode
        )
        VALUES (
            v_opponent_id, p_user_id, 'active', 3, 
            length(v_initial_word), v_initial_word, true, 
            v_opponent_id, 1, v_duration, v_game_mode
        )
        RETURNING id INTO v_game_id;

        -- 5. Create Room 
        INSERT INTO rooms (host_id, status, game_mode, config) 
        VALUES (
            v_opponent_id, 
            'playing', 
            'arena', 
            jsonb_build_object('gameMode', p_mode)
        ) 
        RETURNING id INTO v_room_id;
        
        -- 6. Add participants
        INSERT INTO room_participants (room_id, user_id, status)
        VALUES 
            (v_room_id, v_opponent_id, 'playing'),
            (v_room_id, p_user_id, 'playing');
        
        RETURN v_game_id;
    ELSE
        -- No opponent found, add to queue with Mode
        INSERT INTO matchmaking_queue (user_id, mode) VALUES (p_user_id, p_mode);
        RETURN NULL;
    END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
