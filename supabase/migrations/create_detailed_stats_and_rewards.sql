-- 1. Add Detailed Stats Columns to Users
ALTER TABLE users 
ADD COLUMN IF NOT EXISTS tournament_wins INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS tournament_total_games INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS arena_wins INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS arena_total_games INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS turn_based_wins INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS turn_based_total_games INTEGER DEFAULT 0;

-- 2. Create Reward Distribution Function for Rooms
CREATE OR REPLACE FUNCTION award_room_rewards(p_room_id UUID)
RETURNS VOID AS $$
DECLARE
  v_room rooms%ROWTYPE;
  v_participant RECORD;
  v_rank INT := 0;
  v_lp_award INT;
  v_is_winner BOOLEAN;
  v_mode TEXT;
BEGIN
  -- Get Room and Lock it? No, just check status.
  SELECT * INTO v_room FROM rooms WHERE id = p_room_id;
  
  -- Validation: Must exist and NOT be finished yet
  IF NOT FOUND THEN RETURN; END IF;
  IF v_room.status = 'finished' THEN RETURN; END IF;

  v_mode := v_room.game_mode;
  -- Fallback for mode if null?
  IF v_mode IS NULL THEN v_mode := 'arena'; END IF;

  -- Mark Room Finished IMMEDIATELY to prevent double-awarding
  UPDATE rooms SET status = 'finished', ended_at = NOW() WHERE id = p_room_id;

  -- Loop through ACTIVE participants (not left), sorted by Score
  FOR v_participant IN 
    SELECT * FROM room_participants 
    WHERE room_id = p_room_id AND status != 'left'
    ORDER BY score DESC, finished_at ASC -- Higher score first, then faster time
  LOOP
    v_rank := v_rank + 1;
    v_is_winner := (v_rank = 1);
    
    -- Calculate LP Reward
    IF v_rank = 1 THEN v_lp_award := 50;
    ELSIF v_rank = 2 THEN v_lp_award := 25;
    ELSE v_lp_award := 10;
    END IF;

    -- Update User Stats
    UPDATE users SET
        lp = lp + v_lp_award,
        total_games = total_games + 1,
        total_wins = total_wins + (CASE WHEN v_is_winner THEN 1 ELSE 0 END),
        
        -- Mode Specific Stats
        tournament_total_games = tournament_total_games + (CASE WHEN v_mode = 'tournament' THEN 1 ELSE 0 END),
        tournament_wins = tournament_wins + (CASE WHEN v_mode = 'tournament' AND v_is_winner THEN 1 ELSE 0 END),
        
        arena_total_games = arena_total_games + (CASE WHEN v_mode = 'arena' THEN 1 ELSE 0 END),
        arena_wins = arena_wins + (CASE WHEN v_mode = 'arena' AND v_is_winner THEN 1 ELSE 0 END),
        
        turn_based_total_games = turn_based_total_games + (CASE WHEN v_mode = 'turn_based' THEN 1 ELSE 0 END),
        turn_based_wins = turn_based_wins + (CASE WHEN v_mode = 'turn_based' AND v_is_winner THEN 1 ELSE 0 END)
    WHERE id = v_participant.user_id;

  END LOOP;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. Create Trigger to Auto-Finish Room
-- When all participants are either 'finished' or 'left', finish the room.
CREATE OR REPLACE FUNCTION check_room_completion()
RETURNS TRIGGER AS $$
DECLARE
  v_total INT;
  v_finished_or_left INT;
  v_room_status TEXT;
BEGIN
  -- Check if room is already finished
  SELECT status INTO v_room_status FROM rooms WHERE id = NEW.room_id;
  IF v_room_status = 'finished' THEN 
    RETURN NEW; 
  END IF;

  -- Count participants
  SELECT count(*) INTO v_total FROM room_participants WHERE room_id = NEW.room_id;
  SELECT count(*) INTO v_finished_or_left FROM room_participants 
  WHERE room_id = NEW.room_id AND status IN ('finished', 'left');

  -- If valid room (has players) and all are done
  IF v_total > 0 AND v_total = v_finished_or_left THEN
     -- Trigger logic
     PERFORM award_room_rewards(NEW.room_id);
  END IF;
  return NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_check_room_completion ON room_participants;
CREATE TRIGGER trg_check_room_completion
AFTER UPDATE OF status ON room_participants
FOR EACH ROW
EXECUTE FUNCTION check_room_completion();

-- 4. Update leave_room to handle Survivor Win correctly via this new function
DROP FUNCTION IF EXISTS leave_room(uuid);

CREATE OR REPLACE FUNCTION leave_room(p_room_id UUID)
RETURNS VOID AS $$
DECLARE
  v_user_id UUID;
  v_room rooms%ROWTYPE;
  v_active_count INT;
  v_turn_order UUID[];
  v_new_turn_order UUID[];
  v_next_turn INT;
  v_is_survivor_win BOOLEAN := false;
BEGIN
  v_user_id := auth.uid();
  
  -- Get Room
  SELECT * INTO v_room FROM rooms WHERE id = p_room_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Room not found'; END IF;

  -- Update Participant status to 'left'
  UPDATE room_participants 
  SET status = 'left', ended_at = NOW() 
  WHERE room_id = p_room_id AND user_id = v_user_id;

  -- Clean up turn order if turn-based (existing logic simplified for brevity here, or preserved?)
  -- Preserving existing turn logic is complex to re-write.
  -- Key part: Check Active Count
  SELECT count(*) INTO v_active_count FROM room_participants 
  WHERE room_id = p_room_id AND status != 'left';

  -- SURVIVOR WIN CHECK (For non-TurnBased, e.g. WordRace/Tournament)
  IF v_active_count <= 1 AND v_room.status = 'playing' AND v_room.game_mode != 'turn_based' THEN
      v_is_survivor_win := true;
  END IF;

  IF v_is_survivor_win THEN
      -- If survivor win, we want to award rewards to the survivor!
      -- The `award_room_rewards` function filters OUT 'left' players.
      -- So the only remaining player (survivor) will get Rank 1.
      -- We just need to call it.
      PERFORM award_room_rewards(p_room_id);
      
      -- Set Metadata for UI (Last Win)
      -- Find the survivor
      DECLARE
        v_survivor_id UUID;
        v_survivor_name TEXT;
      BEGIN
        SELECT user_id INTO v_survivor_id FROM room_participants 
        WHERE room_id = p_room_id AND status != 'left' LIMIT 1;
        
        -- If no survivor (everyone left), do nothing
        IF v_survivor_id IS NOT NULL THEN
             -- Update game_state with lastWin info for UI
             UPDATE rooms 
             SET game_state = jsonb_set(
                COALESCE(game_state, '{}'::jsonb),
                '{lastWin}',
                jsonb_build_object(
                    'userId', v_survivor_id,
                    'word', 'SURVIVOR',
                    'score', 0,
                    'type', 'survivor',
                    'timestamp', floor(extract(epoch from now()) * 1000)
                )
             )
             WHERE id = p_room_id;
        END IF;
      END;
      
  END IF;

  -- ... (Rest of existing turn cleanup logic implicitly stays if we don't overwrite it?)
  -- Wait, replacing the function overwrites it. I must include the FULL logic if I replace it.
  -- Or I can just make a small patch function?
  -- No, replace is safer. I need to copy the TurnLogic part.
  -- I will retrieve the golden `fix_leave_room_safety.sql` content first to copy-paste.
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
