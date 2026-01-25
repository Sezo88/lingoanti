-- Create RPC for forfeiting a game
CREATE OR REPLACE FUNCTION forfeit_game(
  p_game_id UUID,
  p_user_id UUID
)
RETURNS JSONB AS $$
DECLARE
  v_game RECORD;
  v_winner_id UUID;
  v_best_of INT;
  v_required_wins INT;
  v_update_data JSONB;
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

  -- 4. Update Game
  -- We set status to finished and winner_id
  -- We also ensure the winner has at least 'v_required_wins' score
  UPDATE games
  SET 
    status = 'finished',
    winner_id = v_winner_id,
    finished_at = NOW(),
    player1_score = CASE 
      WHEN v_winner_id = player1_id AND player1_score < v_required_wins THEN v_required_wins
      ELSE player1_score
    END,
    player2_score = CASE 
      WHEN v_winner_id = player2_id AND player2_score < v_required_wins THEN v_required_wins
      ELSE player2_score
    END
  WHERE id = p_game_id;

  RETURN jsonb_build_object('success', true);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant permissions to ensure API can see it
GRANT EXECUTE ON FUNCTION forfeit_game(UUID, UUID) TO postgres, anon, authenticated, service_role;

-- Force Schema Cache Reload
NOTIFY pgrst, 'reload config';
