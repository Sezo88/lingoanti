-- Add Stats columns to users table
ALTER TABLE users 
ADD COLUMN IF NOT EXISTS total_games INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS total_wins INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS total_losses INTEGER DEFAULT 0;

-- Create RPC to finish game and distribute rewards atomically (WITH STATS)
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
  -- 1. Lock Game Row
  SELECT * INTO v_game FROM games WHERE id = p_game_id FOR UPDATE;
  
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Game not found');
  END IF;

  IF v_game.status = 'finished' THEN
     RETURN jsonb_build_object('success', false, 'error', 'Game already finished');
  END IF;

  v_player1_id := v_game.player1_id;
  v_player2_id := v_game.player2_id;

  -- 2. Calculate Rewards
  IF p_winner_id IS NULL THEN
     -- DRAW
     v_player1_lp_award := 3;
     v_player2_lp_award := 3;
     v_player1_rating_change := 5;
     v_player2_rating_change := 5;
  ELSIF p_winner_id = v_player1_id THEN
     -- Player 1 Wins
     v_player1_lp_award := 10;
     v_player2_lp_award := 1;
     v_player1_rating_change := 25;
     v_player2_rating_change := -15;
  ELSE
     -- Player 2 Wins
     v_player1_lp_award := 1;
     v_player2_lp_award := 10;
     v_player1_rating_change := -15;
     v_player2_rating_change := 25;
  END IF;

  -- 3. Update Users (Atomic Balance & STATS Update)
  -- Player 1
  UPDATE users 
  SET 
    lp = lp + v_player1_lp_award,
    rating = GREATEST(0, rating + v_player1_rating_change),
    total_games = total_games + 1,
    total_wins = CASE WHEN p_winner_id = v_player1_id THEN total_wins + 1 ELSE total_wins END,
    total_losses = CASE WHEN p_winner_id != v_player1_id AND p_winner_id IS NOT NULL THEN total_losses + 1 ELSE total_losses END
  WHERE id = v_player1_id;

  -- Player 2
  UPDATE users 
  SET 
    lp = lp + v_player2_lp_award,
    rating = GREATEST(0, rating + v_player2_rating_change),
    total_games = total_games + 1,
    total_wins = CASE WHEN p_winner_id = v_player2_id THEN total_wins + 1 ELSE total_wins END,
    total_losses = CASE WHEN p_winner_id != v_player2_id AND p_winner_id IS NOT NULL THEN total_losses + 1 ELSE total_losses END
  WHERE id = v_player2_id;

  -- 4. Finish Game
  UPDATE games
  SET 
    status = 'finished',
    winner_id = p_winner_id,
    finished_at = NOW()
  WHERE id = p_game_id;

  -- 5. Return Result
  RETURN jsonb_build_object(
    'success', true,
    'player1', jsonb_build_object('lp', v_player1_lp_award, 'rating', v_player1_rating_change),
    'player2', jsonb_build_object('lp', v_player2_lp_award, 'rating', v_player2_rating_change)
  );

EXCEPTION WHEN others THEN
  RETURN jsonb_build_object('success', false, 'error', SQLERRM);
END;
$$ LANGUAGE plpgsql;
