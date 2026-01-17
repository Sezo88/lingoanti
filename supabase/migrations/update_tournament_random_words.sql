-- Update tournament functions to use MIXED word lengths (random) instead of fixed 5

-- 1. Update find_tournament_match to set initial config to wordLength: 0
CREATE OR REPLACE FUNCTION find_tournament_match(
  p_user_id UUID DEFAULT NULL,
  p_lobby_id UUID DEFAULT NULL,
  p_game_mode TEXT DEFAULT 'arena'
)
RETURNS JSONB AS $$
DECLARE
  v_is_team BOOLEAN;
  v_min_players INTEGER;
  v_max_players INTEGER;
  v_waiting_room_id UUID;
  v_room_id UUID;
  v_room_code TEXT;
  v_current_players INTEGER;
  v_countdown_started TIMESTAMP WITH TIME ZONE;
  v_queue_entries RECORD;
  v_participant_count INTEGER := 0;
  v_lobby_members UUID[];
BEGIN
  -- Determine if team or solo
  v_is_team := (p_lobby_id IS NOT NULL);

  -- Set min/max players based on game mode
  IF p_game_mode = 'arena' THEN
    v_min_players := 4;
    v_max_players := 10;
  ELSIF p_game_mode = 'turn_based' THEN
    v_min_players := 3;
    v_max_players := 5;
  ELSE
    RAISE EXCEPTION 'Invalid game mode';
  END IF;

  -- Add to queue
  IF v_is_team THEN
    INSERT INTO tournament_queue (lobby_id, game_mode, is_team)
    VALUES (p_lobby_id, p_game_mode, true)
    ON CONFLICT DO NOTHING;
  ELSE
    INSERT INTO tournament_queue (user_id, game_mode, is_team)
    VALUES (p_user_id, p_game_mode, false)
    ON CONFLICT DO NOTHING;
  END IF;

  -- Try to find or create a waiting room
  SELECT id, room_id, current_players, countdown_started_at
  INTO v_waiting_room_id, v_room_id, v_current_players, v_countdown_started
  FROM tournament_waiting_rooms
  WHERE game_mode = p_game_mode 
    AND status IN ('filling', 'countdown')
    AND current_players < v_max_players
  ORDER BY created_at ASC
  LIMIT 1
  FOR UPDATE SKIP LOCKED;

  -- If no waiting room exists, create one
  IF v_waiting_room_id IS NULL THEN
    -- Create room first
    INSERT INTO rooms (host_id, status, game_mode, config)
    VALUES (
      COALESCE(p_user_id, (SELECT leader_id FROM tournament_lobbies WHERE id = p_lobby_id)),
      'waiting',
      'tournament',
      jsonb_build_object(
        'isPublic', false,
        'wordCount', 5,
        'wordLength', 0, -- MIXED MODE (Random)
        'duration', 60,
        'gameMode', p_game_mode
      )
    )
    RETURNING id, code INTO v_room_id, v_room_code;

    -- Create waiting room
    INSERT INTO tournament_waiting_rooms (room_id, game_mode, min_players, max_players, current_players, status)
    VALUES (v_room_id, p_game_mode, v_min_players, v_max_players, 0, 'filling')
    RETURNING id INTO v_waiting_room_id;

    v_current_players := 0;
  ELSE
    -- Get room code for existing room
    SELECT code INTO v_room_code FROM rooms WHERE id = v_room_id;
  END IF;

  -- Add participants to room
  IF v_is_team THEN
    -- Get all lobby members
    SELECT ARRAY_AGG(user_id) INTO v_lobby_members
    FROM tournament_lobby_members
    WHERE lobby_id = p_lobby_id;

    -- Add each member
    DECLARE
      v_member_id UUID;
    BEGIN
      FOREACH v_member_id IN ARRAY v_lobby_members LOOP
        INSERT INTO room_participants (room_id, user_id, status)
        VALUES (v_room_id, v_member_id, 'ready')
        ON CONFLICT (room_id, user_id) DO NOTHING;
      END LOOP;
    END;

    v_participant_count := ARRAY_LENGTH(v_lobby_members, 1);
  ELSE
    -- Add solo player
    INSERT INTO room_participants (room_id, user_id, status)
    VALUES (v_room_id, p_user_id, 'ready')
    ON CONFLICT (room_id, user_id) DO NOTHING;

    v_participant_count := 1;
  END IF;

  -- Update waiting room player count
  UPDATE tournament_waiting_rooms
  SET current_players = current_players + v_participant_count
  WHERE id = v_waiting_room_id
  RETURNING current_players INTO v_current_players;

  -- Check if we should start countdown
  IF v_current_players >= v_min_players AND v_countdown_started IS NULL THEN
    UPDATE tournament_waiting_rooms
    SET countdown_started_at = NOW(),
        status = 'countdown'
    WHERE id = v_waiting_room_id;

    v_countdown_started := NOW();
  END IF;

  -- Check if we should start immediately (max players reached)
  IF v_current_players >= v_max_players THEN
    PERFORM start_tournament_game(v_waiting_room_id);
    
    RETURN jsonb_build_object(
      'status', 'matched',
      'room_id', v_room_id,
      'room_code', v_room_code,
      'waiting_room_id', v_waiting_room_id
    );
  END IF;

  -- Return waiting status
  RETURN jsonb_build_object(
    'status', CASE 
      WHEN v_countdown_started IS NOT NULL THEN 'countdown'
      ELSE 'waiting'
    END,
    'room_id', v_room_id,
    'room_code', v_room_code,
    'waiting_room_id', v_waiting_room_id,
    'current_players', v_current_players,
    'min_players', v_min_players,
    'max_players', v_max_players,
    'countdown_started_at', v_countdown_started
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- 2. Update start_tournament_game to use word_length: 0 (Mixed)
CREATE OR REPLACE FUNCTION start_tournament_game(
  p_waiting_room_id UUID
)
RETURNS VOID AS $$
DECLARE
  v_room_id UUID;
  v_game_mode TEXT;
  v_word_count INTEGER := 5;
  v_word_length INTEGER := 0; -- MIXED MODE (Random)
  v_current_players INTEGER;
  v_min_players INTEGER;
  v_participant_ids UUID[];
BEGIN
  -- Get room info and player counts
  SELECT room_id, game_mode, current_players, min_players 
  INTO v_room_id, v_game_mode, v_current_players, v_min_players
  FROM tournament_waiting_rooms
  WHERE id = p_waiting_room_id;

  -- CRITICAL: Check if we have minimum players
  IF v_current_players < v_min_players THEN
    RAISE NOTICE 'Not enough players: % < %', v_current_players, v_min_players;
    RETURN; -- Don't start the game yet
  END IF;

  -- Mark waiting room as started
  UPDATE tournament_waiting_rooms
  SET status = 'started'
  WHERE id = p_waiting_room_id;

  -- Start the room game using existing function
  PERFORM start_room_game(v_room_id, v_word_count, v_word_length);

  -- CRITICAL FIX: If turn-based tournament, initialize turn order and timer
  IF v_game_mode = 'turn_based' THEN
    -- Get all participant IDs
    SELECT ARRAY_AGG(user_id ORDER BY joined_at) INTO v_participant_ids
    FROM room_participants
    WHERE room_id = v_room_id;

    -- Update room config with turn-based settings
    UPDATE rooms
    SET config = jsonb_set(
      jsonb_set(
        jsonb_set(
          COALESCE(config, '{}'::jsonb),
          '{turnOrder}', 
          to_jsonb(v_participant_ids), 
          true
        ),
        '{currentTurn}', '0'::jsonb, true
      ),
      '{turnStartTime}', to_jsonb((EXTRACT(EPOCH FROM NOW()) * 1000)::BIGINT), true
    )
    WHERE id = v_room_id;
  END IF;

  -- Clean up queue entries for participants
  DELETE FROM tournament_queue
  WHERE user_id IN (
    SELECT user_id FROM room_participants WHERE room_id = v_room_id
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
