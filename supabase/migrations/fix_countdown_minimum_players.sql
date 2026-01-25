-- Fix countdown stopping when players leave
-- Problem: Countdown continues even when players drop below minimum

CREATE OR REPLACE FUNCTION cancel_tournament_search(
  p_user_id UUID DEFAULT NULL,
  p_lobby_id UUID DEFAULT NULL
)
RETURNS VOID AS $$
DECLARE
  v_waiting_room_id UUID;
  v_room_id UUID;
  v_is_team BOOLEAN;
  v_count INTEGER;
  v_new_player_count INTEGER;
  v_min_players INTEGER;
BEGIN
  v_is_team := (p_lobby_id IS NOT NULL);

  -- 1. Remove from Queue
  IF v_is_team THEN
    DELETE FROM tournament_queue WHERE lobby_id = p_lobby_id;
  ELSE
    DELETE FROM tournament_queue WHERE user_id = p_user_id;
  END IF;

  -- 2. Find Waiting Room user is in (via room_participants)
  SELECT r.id, wr.id, wr.min_players INTO v_room_id, v_waiting_room_id, v_min_players
  FROM rooms r
  JOIN tournament_waiting_rooms wr ON wr.room_id = r.id
  JOIN room_participants rp ON rp.room_id = r.id
  WHERE (rp.user_id = p_user_id OR (v_is_team AND rp.user_id IN (
      SELECT user_id FROM tournament_lobby_members WHERE lobby_id = p_lobby_id
  )))
  AND wr.status IN ('filling', 'countdown');

  IF v_room_id IS NOT NULL THEN
    -- Remove participant(s)
    IF v_is_team THEN
       DELETE FROM room_participants 
       WHERE room_id = v_room_id 
       AND user_id IN (SELECT user_id FROM tournament_lobby_members WHERE lobby_id = p_lobby_id);
       
       GET DIAGNOSTICS v_count = ROW_COUNT;
    ELSE
       DELETE FROM room_participants 
       WHERE room_id = v_room_id AND user_id = p_user_id;
       
       v_count := 1;
    END IF;

    -- Update waiting room: decrement count AND stop countdown if needed (ATOMIC)
    UPDATE tournament_waiting_rooms
    SET 
      current_players = GREATEST(0, current_players - v_count),
      status = CASE 
        WHEN (current_players - v_count) < min_players THEN 'filling'
        ELSE status
      END,
      countdown_started_at = CASE 
        WHEN (current_players - v_count) < min_players THEN NULL
        ELSE countdown_started_at
      END
    WHERE id = v_waiting_room_id
    RETURNING current_players INTO v_new_player_count;

    -- Log for debugging
    RAISE NOTICE 'Cancelled search: removed % players, new count: %, min: %', v_count, v_new_player_count, v_min_players;

  END IF;

END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
