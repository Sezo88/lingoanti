-- Fix current_players sync issue
-- Problem: current_players shows 1/5 but participant list has 3 people

-- Step 1: Create a function to sync current_players from actual participants
CREATE OR REPLACE FUNCTION sync_tournament_waiting_room_count(p_waiting_room_id UUID)
RETURNS VOID AS $$
DECLARE
  v_room_id UUID;
  v_actual_count INTEGER;
  v_min_players INTEGER;
BEGIN
  -- Get room_id and min_players
  SELECT room_id, min_players INTO v_room_id, v_min_players
  FROM tournament_waiting_rooms
  WHERE id = p_waiting_room_id;

  -- Count actual participants
  SELECT COUNT(*) INTO v_actual_count
  FROM room_participants
  WHERE room_id = v_room_id;

  -- Update waiting room with actual count
  UPDATE tournament_waiting_rooms
  SET 
    current_players = v_actual_count,
    status = CASE 
      WHEN v_actual_count >= min_players AND status = 'filling' THEN 'countdown'
      WHEN v_actual_count < min_players AND status = 'countdown' THEN 'filling'
      ELSE status
    END,
    countdown_started_at = CASE 
      WHEN v_actual_count >= min_players AND countdown_started_at IS NULL THEN NOW()
      WHEN v_actual_count < min_players THEN NULL
      ELSE countdown_started_at
    END
  WHERE id = p_waiting_room_id;

  RAISE NOTICE 'Synced waiting room %: actual participants = %', p_waiting_room_id, v_actual_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Step 2: Update cancel_tournament_search to sync after removing participants
CREATE OR REPLACE FUNCTION cancel_tournament_search(
  p_user_id UUID DEFAULT NULL,
  p_lobby_id UUID DEFAULT NULL
)
RETURNS VOID AS $$
DECLARE
  v_waiting_room_id UUID;
  v_room_id UUID;
  v_is_team BOOLEAN;
BEGIN
  v_is_team := (p_lobby_id IS NOT NULL);

  -- 1. Remove from Queue
  IF v_is_team THEN
    DELETE FROM tournament_queue WHERE lobby_id = p_lobby_id;
  ELSE
    DELETE FROM tournament_queue WHERE user_id = p_user_id;
  END IF;

  -- 2. Find Waiting Room user is in
  SELECT r.id, wr.id INTO v_room_id, v_waiting_room_id
  FROM rooms r
  JOIN tournament_waiting_rooms wr ON wr.room_id = r.id
  JOIN room_participants rp ON rp.room_id = r.id
  WHERE (rp.user_id = p_user_id OR (v_is_team AND rp.user_id IN (
      SELECT user_id FROM tournament_lobby_members WHERE lobby_id = p_lobby_id
  )))
  AND wr.status IN ('filling', 'countdown');

  IF v_room_id IS NOT NULL THEN
    -- 3. Remove participant(s)
    IF v_is_team THEN
       DELETE FROM room_participants 
       WHERE room_id = v_room_id 
       AND user_id IN (SELECT user_id FROM tournament_lobby_members WHERE lobby_id = p_lobby_id);
    ELSE
       DELETE FROM room_participants 
       WHERE room_id = v_room_id AND user_id = p_user_id;
    END IF;

    -- 4. CRITICAL: Sync count from actual participants
    PERFORM sync_tournament_waiting_room_count(v_waiting_room_id);
  END IF;

END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Step 3: Update find_tournament_match to sync after adding participants
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
  v_participant_count INTEGER := 0;
  v_lobby_members UUID[];
  v_status TEXT;
  v_member_id UUID; -- ADDED: Missing variable
BEGIN
  v_is_team := (p_lobby_id IS NOT NULL);

  -- Set min/max players
  IF p_game_mode = 'arena' THEN
    v_min_players := 3;
    v_max_players := 5;
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

  -- Find or create waiting room
  SELECT id, room_id INTO v_waiting_room_id, v_room_id
  FROM tournament_waiting_rooms
  WHERE game_mode = p_game_mode 
    AND status IN ('filling', 'countdown')
    AND current_players < v_max_players
  ORDER BY created_at ASC
  LIMIT 1
  FOR UPDATE SKIP LOCKED;

  IF v_waiting_room_id IS NULL THEN
    -- Create new room
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

    INSERT INTO tournament_waiting_rooms (room_id, game_mode, min_players, max_players, current_players, status)
    VALUES (v_room_id, p_game_mode, v_min_players, v_max_players, 0, 'filling')
    RETURNING id INTO v_waiting_room_id;
  ELSE
    SELECT code INTO v_room_code FROM rooms WHERE id = v_room_id;
  END IF;

  -- Add participants
  IF v_is_team THEN
    SELECT ARRAY_AGG(user_id) INTO v_lobby_members
    FROM tournament_lobby_members WHERE lobby_id = p_lobby_id;

    FOREACH v_member_id IN ARRAY v_lobby_members LOOP
      INSERT INTO room_participants (room_id, user_id, status)
      VALUES (v_room_id, v_member_id, 'ready')
      ON CONFLICT (room_id, user_id) DO NOTHING;
    END LOOP;
  ELSE
    INSERT INTO room_participants (room_id, user_id, status)
    VALUES (v_room_id, p_user_id, 'ready')
    ON CONFLICT (room_id, user_id) DO NOTHING;
  END IF;

  -- CRITICAL: Sync count from actual participants
  PERFORM sync_tournament_waiting_room_count(v_waiting_room_id);

  -- Get updated values
  SELECT current_players, countdown_started_at, status 
  INTO v_current_players, v_countdown_started, v_status
  FROM tournament_waiting_rooms
  WHERE id = v_waiting_room_id;

  -- Check if max players reached
  IF v_current_players >= v_max_players THEN
    PERFORM start_tournament_game(v_waiting_room_id);
    
    RETURN jsonb_build_object(
      'status', 'matched',
      'room_id', v_room_id,
      'room_code', v_room_code,
      'waiting_room_id', v_waiting_room_id
    );
  END IF;

  -- Return status
  RETURN jsonb_build_object(
    'status', CASE WHEN v_countdown_started IS NOT NULL THEN 'countdown' ELSE 'waiting' END,
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
