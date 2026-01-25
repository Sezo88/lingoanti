-- 1. Add total_score column
ALTER TABLE users ADD COLUMN IF NOT EXISTS total_score INTEGER DEFAULT 0;

-- 2. Update Reward Function to accumulate Game Score into Total Score
CREATE OR REPLACE FUNCTION award_room_rewards(p_room_id UUID)
RETURNS VOID AS $$
DECLARE
  v_room rooms%ROWTYPE;
  v_participant RECORD;
  v_rank INT := 0;
  v_lp_award INT;
  v_mode TEXT;
BEGIN
  -- Get Room information
  SELECT * INTO v_room FROM rooms WHERE id = p_room_id;
  
  -- Validation
  IF NOT FOUND THEN RETURN; END IF;
  IF v_room.status = 'finished' THEN RETURN; END IF;

  v_mode := v_room.game_mode;
  IF v_mode IS NULL THEN v_mode := 'arena'; END IF;

  -- Mark Room Finished
  UPDATE rooms SET status = 'finished', ended_at = NOW() WHERE id = p_room_id;

  -- Loop participants to award stats
  FOR v_participant IN 
    SELECT * FROM room_participants 
    WHERE room_id = p_room_id AND status != 'left'
    ORDER BY score DESC, finished_at ASC NULLS LAST
  LOOP
    v_rank := v_rank + 1;
    
    -- LP Reward Calculation
    IF v_rank = 1 THEN v_lp_award := 50;
    ELSIF v_rank = 2 THEN v_lp_award := 25;
    ELSE v_lp_award := 10;
    END IF;

    -- Update User Stats
    UPDATE users SET
        lp = lp + v_lp_award,
        
        -- NEW: Add Game Score to Total Score
        total_score = total_score + v_participant.score,
        
        total_games = total_games + 1,
        total_wins = total_wins + (CASE WHEN v_rank = 1 THEN 1 ELSE 0 END),
        
        -- Mode Specific
        tournament_total_games = tournament_total_games + (CASE WHEN v_mode = 'tournament' THEN 1 ELSE 0 END),
        tournament_wins = tournament_wins + (CASE WHEN v_mode = 'tournament' AND v_rank = 1 THEN 1 ELSE 0 END),
        tournament_2nd = tournament_2nd + (CASE WHEN v_mode = 'tournament' AND v_rank = 2 THEN 1 ELSE 0 END),
        tournament_3rd = tournament_3rd + (CASE WHEN v_mode = 'tournament' AND v_rank = 3 THEN 1 ELSE 0 END),
        
        arena_total_games = arena_total_games + (CASE WHEN v_mode = 'arena' THEN 1 ELSE 0 END),
        arena_wins = arena_wins + (CASE WHEN v_mode = 'arena' AND v_rank = 1 THEN 1 ELSE 0 END),
        
        turn_based_total_games = turn_based_total_games + (CASE WHEN v_mode = 'turn_based' THEN 1 ELSE 0 END),
        turn_based_wins = turn_based_wins + (CASE WHEN v_mode = 'turn_based' AND v_rank = 1 THEN 1 ELSE 0 END)
    WHERE id = v_participant.user_id;

  END LOOP;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
