-- Refactor forfeit_game_v2 to use finish_game_with_rewards
-- This ensures forfeits also award LP/Rating and update Stats properly
CREATE OR REPLACE FUNCTION forfeit_game_v2(
  p_game_id UUID,
  p_user_id UUID
)
RETURNS JSONB AS $$
DECLARE
  v_game RECORD;
  v_winner_id UUID;
  v_best_of INT;
  v_required_wins INT;
  v_result JSONB;
BEGIN
  -- 1. Get game info
  SELECT * INTO v_game FROM games WHERE id = p_game_id;
  
  IF v_game IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Game not found');
  END IF;

  -- 2. Determine winner (the OTHER player)
  IF v_game.player1_id = p_user_id THEN
    v_winner_id := v_game.player2_id;
  ELSE
    v_winner_id := v_game.player1_id;
  END IF;

  -- 3. Calculate Scores for Best Of
  -- Ensure winner gets enough points to win the set immediately
  v_best_of := COALESCE(v_game.best_of, 1);
  v_required_wins := CEIL(v_best_of::FLOAT / 2);

  -- 4. Update Game Scores ONLY (Status will be updated by finish_game_with_rewards)
  UPDATE games
  SET 
    player1_score = CASE 
      WHEN v_winner_id = player1_id AND player1_score < v_required_wins THEN v_required_wins
      ELSE player1_score
    END,
    player2_score = CASE 
      WHEN v_winner_id = player2_id AND player2_score < v_required_wins THEN v_required_wins
      ELSE player2_score
    END
  WHERE id = p_game_id;

  -- 5. Call finish_game_with_rewards to handle Status, LP, Rating, and Stats
  SELECT finish_game_with_rewards(p_game_id, v_winner_id) INTO v_result;

  -- Return the result from the inner transaction
  RETURN v_result;

EXCEPTION WHEN others THEN
  RETURN jsonb_build_object('success', false, 'error', SQLERRM);
END;
$$ LANGUAGE plpgsql;
