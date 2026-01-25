-- ==========================================
-- MANUAL FIX SCRIPT (CONSOLIDATED)
-- ==========================================

-- 1. Fix Forfeit Game (V2) - Bypasses cache issues
CREATE OR REPLACE FUNCTION forfeit_game_v2(
  p_game_id UUID,
  p_user_id UUID
)
RETURNS JSONB AS $$
DECLARE
  v_game RECORD;
  v_winner_id UUID;
  v_best_of INT;
  v_required_wins INT;
  v_update_data JSONB;
BEGIN
  -- 1. Get game info
  SELECT * INTO v_game FROM games WHERE id = p_game_id;
  
  IF v_game IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Game not found');
  END IF;

  -- 2. Determine winner (the OTHER player)
  IF v_game.player1_id = p_user_id THEN
    v_winner_id := v_game.player2_id;
  ELSE
    v_winner_id := v_game.player1_id;
  END IF;

  -- 3. Calculate Scores for Best Of
  -- Ensure winner gets enough points to win the set immediately
  v_best_of := COALESCE(v_game.best_of, 1);
  v_required_wins := CEIL(v_best_of::FLOAT / 2);

  -- 4. Update Game
  UPDATE games
  SET 
    status = 'finished',
    winner_id = v_winner_id,
    finished_at = NOW(),
    player1_score = CASE 
      WHEN v_winner_id = player1_id AND player1_score < v_required_wins THEN v_required_wins
      ELSE player1_score
    END,
    player2_score = CASE 
      WHEN v_winner_id = player2_id AND player2_score < v_required_wins THEN v_required_wins
      ELSE player2_score
    END
  WHERE id = p_game_id;

  RETURN jsonb_build_object('success', true);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant permissions explicitly
GRANT EXECUTE ON FUNCTION forfeit_game_v2(UUID, UUID) TO postgres, anon, authenticated, service_role;


-- 2. Fix Matchmaking (Best of 3 + Duration + Mixed Mode)
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

        -- 4. Create a new Game
        -- FIX: Use 'active' status, initialize turn/round, set Duration to 60s
        INSERT INTO games (player1_id, player2_id, status, best_of, word_length, target_word, mixed_mode, current_turn, current_round, duration)
        VALUES (v_opponent_id, p_user_id, 'active', 3, length(v_initial_word), v_initial_word, true, v_opponent_id, 1, 60)
        RETURNING id INTO v_game_id;

        -- 5. Create a ROOM for the actual gameplay (Arena Mode)
        INSERT INTO rooms (
            host_id, 
            status, 
            game_mode, 
            game_words, 
            config
        )
        VALUES (
            v_opponent_id, 
            'playing',
            'arena',
            (SELECT ARRAY(SELECT word FROM words WHERE length = 5 ORDER BY RANDOM() LIMIT 3)), 
            jsonb_build_object(
                'isPublic', false,
                'maxPlayers', 2,
                'wordCount', 3, 
                'wordLength', 5,
                'duration', 90, 
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

-- Check permissions
GRANT EXECUTE ON FUNCTION find_match(UUID) TO postgres, anon, authenticated, service_role;

-- Force Reload
NOTIFY pgrst, 'reload config';
