-- 1. Add Podium Columns (2nd and 3rd place)
ALTER TABLE users 
ADD COLUMN IF NOT EXISTS tournament_2nd INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS tournament_3rd INTEGER DEFAULT 0;

-- 2. Update Reward Function to Track Podium Finishes
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

  -- Loop through participants
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

    -- Update User Stats including Podium
    UPDATE users SET
        lp = lp + v_lp_award,
        total_games = total_games + 1,
        total_wins = total_wins + (CASE WHEN v_rank = 1 THEN 1 ELSE 0 END),
        
        -- Tournament Specific Stats
        tournament_total_games = tournament_total_games + (CASE WHEN v_mode = 'tournament' THEN 1 ELSE 0 END),
        tournament_wins = tournament_wins + (CASE WHEN v_mode = 'tournament' AND v_rank = 1 THEN 1 ELSE 0 END),
        tournament_2nd = tournament_2nd + (CASE WHEN v_mode = 'tournament' AND v_rank = 2 THEN 1 ELSE 0 END),
        tournament_3rd = tournament_3rd + (CASE WHEN v_mode = 'tournament' AND v_rank = 3 THEN 1 ELSE 0 END),
        
        -- Arena Stats
        arena_total_games = arena_total_games + (CASE WHEN v_mode = 'arena' THEN 1 ELSE 0 END),
        arena_wins = arena_wins + (CASE WHEN v_mode = 'arena' AND v_rank = 1 THEN 1 ELSE 0 END),
        
        -- Turn-Based Stats
        turn_based_total_games = turn_based_total_games + (CASE WHEN v_mode = 'turn_based' THEN 1 ELSE 0 END),
        turn_based_wins = turn_based_wins + (CASE WHEN v_mode = 'turn_based' AND v_rank = 1 THEN 1 ELSE 0 END)
    WHERE id = v_participant.user_id;

  END LOOP;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. Update Reader RPC to return REAL 2nd/3rd place values
CREATE OR REPLACE FUNCTION get_full_user_profile(
    target_user_id UUID,
    requesting_user_id UUID
)
RETURNS TABLE (
    user_id UUID,
    username TEXT,
    display_name TEXT,
    avatar_id INTEGER,
    email TEXT,
    created_at TIMESTAMP WITH TIME ZONE,
    total_score INTEGER,
    total_wins INTEGER,
    total_losses INTEGER,
    total_games INTEGER,
    win_rate NUMERIC,
    longest_win_streak INTEGER,
    privacy_settings JSONB,
    is_own_profile BOOLEAN,
    wins_quick INTEGER,
    losses_quick INTEGER,
    wins_1v1 INTEGER,
    losses_1v1 INTEGER,
    tournament_1st INTEGER,
    tournament_2nd INTEGER,
    tournament_3rd INTEGER,
    tournaments_played INTEGER
) AS $$
DECLARE
    v_privacy JSONB;
    v_show_stats BOOLEAN;
    v_is_own BOOLEAN;
    v_user users%ROWTYPE;
BEGIN
    SELECT * INTO v_user FROM users WHERE id = target_user_id;
    
    IF NOT FOUND THEN RETURN; END IF;

    v_is_own := (target_user_id = requesting_user_id);
    v_privacy := v_user.privacy_settings;
    
    IF v_privacy IS NULL THEN
        v_privacy := '{"show_email": false, "show_stats": true}'::jsonb;
    END IF;

    v_show_stats := (v_privacy->>'show_stats')::BOOLEAN;
    IF v_show_stats IS NULL THEN v_show_stats := true; END IF;

    IF NOT v_is_own AND NOT v_show_stats THEN
        RETURN QUERY SELECT
            v_user.id, v_user.username, v_user.display_name, v_user.avatar_id,
            CASE WHEN (v_privacy->>'show_email')::BOOLEAN THEN v_user.email ELSE NULL END,
            v_user.created_at,
            NULL::INTEGER, NULL::INTEGER, NULL::INTEGER, NULL::INTEGER, NULL::NUMERIC, NULL::INTEGER,
            v_privacy, v_is_own,
            NULL::INTEGER, NULL::INTEGER, NULL::INTEGER, NULL::INTEGER,
            NULL::INTEGER, NULL::INTEGER, NULL::INTEGER, NULL::INTEGER;
    ELSE
        RETURN QUERY SELECT
            v_user.id, v_user.username, v_user.display_name, v_user.avatar_id,
            CASE WHEN v_is_own OR (v_privacy->>'show_email')::BOOLEAN THEN v_user.email ELSE NULL END,
            v_user.created_at,
            v_user.total_score, v_user.total_wins, v_user.total_losses, v_user.total_games,
            CASE WHEN v_user.total_games > 0 THEN ROUND((v_user.total_wins::NUMERIC / v_user.total_games::NUMERIC) * 100, 1) ELSE 0 END,
            v_user.longest_win_streak,
            v_privacy, v_is_own,
            v_user.arena_wins, (v_user.arena_total_games - v_user.arena_wins),
            v_user.turn_based_wins, (v_user.turn_based_total_games - v_user.turn_based_wins),
            v_user.tournament_wins,
            v_user.tournament_2nd, -- MAPPED CORRECTLY
            v_user.tournament_3rd, -- MAPPED CORRECTLY
            v_user.tournament_total_games;
    END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
