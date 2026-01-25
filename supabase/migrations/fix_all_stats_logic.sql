-- Consolidated Fix for Forfeit, Rewards, and Stats (1v1 & Rooms)

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

  -- Rewards: Winner 10, Loser 0
  IF p_winner_id IS NULL THEN
     v_player1_lp_award := 3; v_player2_lp_award := 3;
     v_player1_rating_change := 5; v_player2_rating_change := 5;
  ELSIF p_winner_id = v_player1_id THEN
     v_player1_lp_award := 10; v_player2_lp_award := 0;
     v_player1_rating_change := 25; v_player2_rating_change := -15;
  ELSE
     v_player1_lp_award := 0; v_player2_lp_award := 10;
     v_player1_rating_change := -15; v_player2_rating_change := 25;
  END IF;

  -- Update Player 1
  UPDATE users 
  SET 
    lp = lp + v_player1_lp_award,
    rating = GREATEST(0, rating + v_player1_rating_change),
    total_score = total_score + COALESCE(v_game.player1_score, 0), -- Add Game Score to Profile
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
    total_score = total_score + COALESCE(v_game.player2_score, 0), -- Add Game Score to Profile
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
