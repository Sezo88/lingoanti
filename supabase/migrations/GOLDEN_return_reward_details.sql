-- FIX: Return Reward Details in finish_game_with_rewards so UI can display them

CREATE OR REPLACE FUNCTION finish_game_with_rewards(
  p_game_id UUID,
  p_winner_id UUID -- NULL for Draw
)
RETURNS JSONB AS $$
DECLARE
  v_game games%ROWTYPE;
  v_player1_lp_award INT := 0;
  v_player2_lp_award INT := 0;
  v_player1_score_award INT := 0;
  v_player2_score_award INT := 0;
  v_player1_rating_change INT := 0;
  v_player2_rating_change INT := 0;
  v_player1_id UUID;
  v_player2_id UUID;
  v_result JSONB;
  v_mode TEXT;
BEGIN
  -- Lock Game
  SELECT * INTO v_game FROM games WHERE id = p_game_id FOR UPDATE;
  
  IF NOT FOUND THEN RETURN jsonb_build_object('success', false, 'error', 'Game not found'); END IF;
  -- If already finished, return success false but maybe we should return the previous result? Use error for now.
  IF v_game.status = 'finished' THEN RETURN jsonb_build_object('success', false, 'error', 'Game already finished'); END IF;

  v_player1_id := v_game.player1_id;
  v_player2_id := v_game.player2_id;
  v_mode := v_game.game_mode;
  IF v_mode IS NULL THEN v_mode := 'arena'; END IF; 

  -- Rewards Definition
  -- LP/Tickets: Currency (For Jokers) -> Win: 10, Loss: 0
  -- Score: Leaderboard -> Win: 25, Loss: 5 (Plus Round Score)
  
  -- Rewards Definition
  -- LP/Tickets: Currency (For Jokers) -> Win: 10, Loss: 0
  -- Score: Leaderboard -> Win: 25, Loss: 5 (Plus Round Score)
  
  IF p_winner_id IS NULL THEN
     -- DRAW
     v_player1_lp_award := 3;     v_player2_lp_award := 3;
     v_player1_score_award := 10; v_player2_score_award := 10;
     
     IF v_mode IN ('arena', 'quick') THEN
         v_player1_rating_change := 5; v_player2_rating_change := 5;
     END IF;
  ELSIF p_winner_id = v_player1_id THEN
     -- Player 1 Wins
     v_player1_lp_award := 10;    v_player2_lp_award := 0;
     v_player1_score_award := 25; v_player2_score_award := 5;
     
     IF v_mode IN ('arena', 'quick') THEN
         v_player1_rating_change := 25; v_player2_rating_change := -15;
     END IF;
  ELSE
     -- Player 2 Wins
     v_player1_lp_award := 0;     v_player2_lp_award := 10;
     v_player1_score_award := 5;  v_player2_score_award := 25;
     
     IF v_mode IN ('arena', 'quick') THEN
         v_player1_rating_change := -15; v_player2_rating_change := 25;
     END IF;
  END IF;

  -- Update Player 1 (Stats)
  UPDATE users 
  SET 
    lp = lp + v_player1_lp_award,
    rating = GREATEST(0, rating + v_player1_rating_change),
    total_score = total_score + COALESCE(v_game.player1_score, 0) + v_player1_score_award,
    total_games = total_games + 1,
    total_wins = CASE WHEN p_winner_id = v_player1_id THEN total_wins + 1 ELSE total_wins END,
    total_losses = CASE WHEN p_winner_id != v_player1_id AND p_winner_id IS NOT NULL THEN total_losses + 1 ELSE total_losses END,
    
    -- Mode Specific Stats
    arena_total_games  = arena_total_games + (CASE WHEN v_mode = 'arena' THEN 1 ELSE 0 END),
    arena_wins         = arena_wins + (CASE WHEN v_mode = 'arena' AND p_winner_id = v_player1_id THEN 1 ELSE 0 END),
    
    wins_1v1           = COALESCE(wins_1v1, 0) + (CASE WHEN v_mode = '1v1' AND p_winner_id = v_player1_id THEN 1 ELSE 0 END),
    losses_1v1         = COALESCE(losses_1v1, 0) + (CASE WHEN v_mode = '1v1' AND p_winner_id != v_player1_id AND p_winner_id IS NOT NULL THEN 1 ELSE 0 END),
    
    wins_quick         = COALESCE(wins_quick, 0) + (CASE WHEN v_mode = 'quick' AND p_winner_id = v_player1_id THEN 1 ELSE 0 END),
    losses_quick       = COALESCE(losses_quick, 0) + (CASE WHEN v_mode = 'quick' AND p_winner_id != v_player1_id AND p_winner_id IS NOT NULL THEN 1 ELSE 0 END),
    
    tournament_total_games = tournament_total_games + (CASE WHEN v_mode = 'tournament' THEN 1 ELSE 0 END),
    tournament_wins    = tournament_wins + (CASE WHEN v_mode = 'tournament' AND p_winner_id = v_player1_id THEN 1 ELSE 0 END)
  WHERE id = v_player1_id;

  -- Update Player 2 (Stats)
  UPDATE users 
  SET 
    lp = lp + v_player2_lp_award,
    rating = GREATEST(0, rating + v_player2_rating_change),
    total_score = total_score + COALESCE(v_game.player2_score, 0) + v_player2_score_award,
    total_games = total_games + 1,
    total_wins = CASE WHEN p_winner_id = v_player2_id THEN total_wins + 1 ELSE total_wins END,
    total_losses = CASE WHEN p_winner_id != v_player2_id AND p_winner_id IS NOT NULL THEN total_losses + 1 ELSE total_losses END,
    
    -- Mode Specific Stats
    arena_total_games  = arena_total_games + (CASE WHEN v_mode = 'arena' THEN 1 ELSE 0 END),
    arena_wins         = arena_wins + (CASE WHEN v_mode = 'arena' AND p_winner_id = v_player2_id THEN 1 ELSE 0 END),
    
    wins_1v1           = COALESCE(wins_1v1, 0) + (CASE WHEN v_mode = '1v1' AND p_winner_id = v_player2_id THEN 1 ELSE 0 END),
    losses_1v1         = COALESCE(losses_1v1, 0) + (CASE WHEN v_mode = '1v1' AND p_winner_id != v_player2_id AND p_winner_id IS NOT NULL THEN 1 ELSE 0 END),
    
    wins_quick         = COALESCE(wins_quick, 0) + (CASE WHEN v_mode = 'quick' AND p_winner_id = v_player2_id THEN 1 ELSE 0 END),
    losses_quick       = COALESCE(losses_quick, 0) + (CASE WHEN v_mode = 'quick' AND p_winner_id != v_player2_id AND p_winner_id IS NOT NULL THEN 1 ELSE 0 END),

    tournament_total_games = tournament_total_games + (CASE WHEN v_mode = 'tournament' THEN 1 ELSE 0 END),
    tournament_wins    = tournament_wins + (CASE WHEN v_mode = 'tournament' AND p_winner_id = v_player2_id THEN 1 ELSE 0 END)
  WHERE id = v_player2_id;

  -- Update user_currency TICKETS (Real LPara)
  UPDATE user_currency SET tickets = tickets + v_player1_lp_award, updated_at = NOW() WHERE user_id = v_player1_id;
  UPDATE user_currency SET tickets = tickets + v_player2_lp_award, updated_at = NOW() WHERE user_id = v_player2_id;

  -- Mark Finished
  UPDATE games SET status = 'finished', winner_id = p_winner_id, finished_at = NOW() WHERE id = p_game_id;

  -- Construct Result Object with Reward Details
  v_result := jsonb_build_object(
    'success', true,
    'player1', jsonb_build_object(
        'lp_award', v_player1_lp_award,
        'score_award', v_player1_score_award,
        'rating_change', v_player1_rating_change,
        'lp', v_player1_lp_award -- Map to 'lp' for frontend compatibility
    ),
    'player2', jsonb_build_object(
        'lp_award', v_player2_lp_award,
        'score_award', v_player2_score_award,
        'rating_change', v_player2_rating_change,
        'lp', v_player2_lp_award -- Map to 'lp' for frontend compatibility
    )
  );

  RETURN v_result;

EXCEPTION WHEN others THEN
  RETURN jsonb_build_object('success', false, 'error', SQLERRM);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
