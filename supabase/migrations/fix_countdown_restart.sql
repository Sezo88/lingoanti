-- Fix countdown restart after player leaves and rejoins
-- Problem 1: Countdown doesn't stop when players drop below minimum
-- Problem 2: Countdown doesn't restart when players rejoin

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
  v_waiting_room_status TEXT;
BEGIN
  -- Determine if team or solo
  v_is_team := (p_lobby_id IS NOT NULL);

  -- Set min/max players based on game mode
  IF p_game_mode = 'arena' THEN
    v_min_players := 3;
    v_max_players := 5; -- CHANGED from 10 to 5
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
  SELECT id, room_id, current_players, countdown_started_at, status
  INTO v_waiting_room_id, v_room_id, v_current_players, v_countdown_started, v_waiting_room_status
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
        'wordLength', 0,
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
    v_countdown_started := NULL;
    v_waiting_room_status := 'filling';
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

  -- CRITICAL FIX: Re-fetch countdown status from DB (not from variable)
  SELECT countdown_started_at, status INTO v_countdown_started, v_waiting_room_status
  FROM tournament_waiting_rooms
  WHERE id = v_waiting_room_id;

  -- Check if we should start countdown
  IF v_current_players >= v_min_players AND v_countdown_started IS NULL THEN
    UPDATE tournament_waiting_rooms
    SET countdown_started_at = NOW(),
        status = 'countdown'
    WHERE id = v_waiting_room_id;

    v_countdown_started := NOW();
    v_waiting_room_status := 'countdown';
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
