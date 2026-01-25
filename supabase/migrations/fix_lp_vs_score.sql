-- Consolidated Fix for Rewards (Separating LP vs Score)

-- 1. Finish Game Trigger (For 1v1 Quick Games)
CREATE OR REPLACE FUNCTION finish_game_with_rewards(
  p_game_id UUID,
  p_winner_id UUID -- NULL for Draw
)
RETURNS JSONB AS $$
DECLARE
  v_game games%ROWTYPE;
  v_player1_lp_award INT := 0;
  v_player2_lp_award INT := 0;
  v_player1_score_award INT := 0; -- NEW: Separate Score Award
  v_player2_score_award INT := 0; -- NEW: Separate Score Award
  v_player1_rating_change INT := 0;
  v_player2_rating_change INT := 0;
  v_player1_id UUID;
  v_player2_id UUID;
BEGIN
  -- Lock Game
  SELECT * INTO v_game FROM games WHERE id = p_game_id FOR UPDATE;
  
  IF NOT FOUND THEN RETURN jsonb_build_object('success', false, 'error', 'Game not found'); END IF;
  IF v_game.status = 'finished' THEN RETURN jsonb_build_object('success', false, 'error', 'Game already finished'); END IF;

  v_player1_id := v_game.player1_id;
  v_player2_id := v_game.player2_id;

  -- Rewards Definition
  -- LP: Currency (For Jokers) -> Win: 10, Loss: 0
  -- Score: Leaderboard -> Win: 25, Loss: 5 (Plus Round Score)
  
  IF p_winner_id IS NULL THEN
     -- DRAW
     v_player1_lp_award := 3;     v_player2_lp_award := 3;
     v_player1_score_award := 10; v_player2_score_award := 10;
     v_player1_rating_change := 5; v_player2_rating_change := 5;
  ELSIF p_winner_id = v_player1_id THEN
     -- Player 1 Wins
     v_player1_lp_award := 10;    v_player2_lp_award := 0;
     v_player1_score_award := 25; v_player2_score_award := 5;
     v_player1_rating_change := 25; v_player2_rating_change := -15;
  ELSE
     -- Player 2 Wins
     v_player1_lp_award := 0;     v_player2_lp_award := 10;
     v_player1_score_award := 5;  v_player2_score_award := 25;
     v_player1_rating_change := -15; v_player2_rating_change := 25;
  END IF;

  -- Update Player 1
  UPDATE users 
  SET 
    lp = lp + v_player1_lp_award,
    rating = GREATEST(0, rating + v_player1_rating_change),
    -- TOTAL SCORE = Accumulated Round Score + Match Bonus
    total_score = total_score + COALESCE(v_game.player1_score, 0) + v_player1_score_award,
    total_games = total_games + 1,
    total_wins = CASE WHEN p_winner_id = v_player1_id THEN total_wins + 1 ELSE total_wins END,
    total_losses = CASE WHEN p_winner_id != v_player1_id AND p_winner_id IS NOT NULL THEN total_losses + 1 ELSE total_losses END,
    
    -- Specific Stats
    arena_total_games = COALESCE(arena_total_games, 0) + 1,
    arena_wins = COALESCE(arena_wins, 0) + (CASE WHEN p_winner_id = v_player1_id THEN 1 ELSE 0 END)
  WHERE id = v_player1_id;

  -- Update Player 2
  UPDATE users 
  SET 
    lp = lp + v_player2_lp_award,
    rating = GREATEST(0, rating + v_player2_rating_change),
    -- TOTAL SCORE = Accumulated Round Score + Match Bonus
    total_score = total_score + COALESCE(v_game.player2_score, 0) + v_player2_score_award,
    total_games = total_games + 1,
    total_wins = CASE WHEN p_winner_id = v_player2_id THEN total_wins + 1 ELSE total_wins END,
    total_losses = CASE WHEN p_winner_id != v_player2_id AND p_winner_id IS NOT NULL THEN total_losses + 1 ELSE total_losses END,

    -- Specific Stats
    arena_total_games = COALESCE(arena_total_games, 0) + 1,
    arena_wins = COALESCE(arena_wins, 0) + (CASE WHEN p_winner_id = v_player2_id THEN 1 ELSE 0 END)
  WHERE id = v_player2_id;

  -- Mark Finished
  UPDATE games SET status = 'finished', winner_id = p_winner_id, finished_at = NOW() WHERE id = p_game_id;

  RETURN jsonb_build_object('success', true);
EXCEPTION WHEN others THEN
  RETURN jsonb_build_object('success', false, 'error', SQLERRM);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- 2. Forfeit Logic (Uses finish_game_with_rewards)
CREATE OR REPLACE FUNCTION forfeit_game_v2(
  p_game_id UUID,
  p_user_id UUID
)
RETURNS JSONB AS $$
DECLARE
  v_game RECORD;
  v_winner_id UUID;
  v_result JSONB;
BEGIN
  SELECT * INTO v_game FROM games WHERE id = p_game_id;
  IF v_game IS NULL THEN RETURN jsonb_build_object('success', false, 'error', 'Game not found'); END IF;

  -- Identify Winner (The one who didn't forfeit)
  IF v_game.player1_id = p_user_id THEN
    v_winner_id := v_game.player2_id;
  ELSE
    v_winner_id := v_game.player1_id;
  END IF;

  -- Call Finish to distribute rewards/stats
  SELECT finish_game_with_rewards(p_game_id, v_winner_id) INTO v_result;

  RETURN v_result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. Room Rewards (Tournament / Custom)
CREATE OR REPLACE FUNCTION award_room_rewards(p_room_id UUID)
RETURNS VOID AS $$
DECLARE
  v_room rooms%ROWTYPE;
  v_participant RECORD;
  v_rank INT := 0;
  v_lp_award INT;
  v_score_award INT; -- NEW
  v_mode TEXT;
BEGIN
  SELECT * INTO v_room FROM rooms WHERE id = p_room_id;
  
  IF NOT FOUND THEN RETURN; END IF;
  IF v_room.status = 'finished' THEN RETURN; END IF;

  v_mode := v_room.game_mode;
  IF v_mode IS NULL THEN v_mode := 'arena'; END IF;

  UPDATE rooms SET status = 'finished', ended_at = NOW() WHERE id = p_room_id;

  FOR v_participant IN 
    SELECT * FROM room_participants 
    WHERE room_id = p_room_id AND status != 'left'
    ORDER BY score DESC, finished_at ASC NULLS LAST
  LOOP
    v_rank := v_rank + 1;
    
    -- Tournament/Room Rewards
    -- 1st: 50 LP, 100 Score
    -- 2nd: 25 LP, 50 Score
    -- 3rd: 10 LP, 25 Score
    -- Others: 5 LP, 10 Score
    
    IF v_rank = 1 THEN 
        v_lp_award := 50; v_score_award := 100;
    ELSIF v_rank = 2 THEN 
        v_lp_award := 25; v_score_award := 50;
    ELSIF v_rank = 3 THEN 
        v_lp_award := 10; v_score_award := 25;
    ELSE 
        v_lp_award := 5; v_score_award := 10;
    END IF;

    UPDATE users SET
        lp = lp + v_lp_award,
        -- Add Room Score + Bonus Score
        total_score = total_score + v_participant.score + v_score_award, 
        
        total_games = total_games + 1,
        total_wins = total_wins + (CASE WHEN v_rank = 1 THEN 1 ELSE 0 END),
        
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
