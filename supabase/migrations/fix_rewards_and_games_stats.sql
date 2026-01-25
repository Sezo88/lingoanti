-- Update finish_game_with_rewards to support Detailed Stats and Correct Rewards (10/0)
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

  -- 2. Calculate Rewards (10 LP for winner, 0 for loser)
  IF p_winner_id IS NULL THEN
     -- DRAW
     v_player1_lp_award := 3;
     v_player2_lp_award := 3;
     v_player1_rating_change := 5;
     v_player2_rating_change := 5;
  ELSIF p_winner_id = v_player1_id THEN
     -- Player 1 Wins
     v_player1_lp_award := 10;
     v_player2_lp_award := 0; -- Changed from 1
     v_player1_rating_change := 25;
     v_player2_rating_change := -15;
  ELSE
     -- Player 2 Wins
     v_player1_lp_award := 0; -- Changed from 1
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
    total_losses = CASE WHEN p_winner_id != v_player1_id AND p_winner_id IS NOT NULL THEN total_losses + 1 ELSE total_losses END,
    
    -- NEW: Update specific Arena stats (since Games are 1v1 Arena)
    arena_total_games = COALESCE(arena_total_games, 0) + 1,
    arena_wins = COALESCE(arena_wins, 0) + (CASE WHEN p_winner_id = v_player1_id THEN 1 ELSE 0 END)
  WHERE id = v_player1_id;

  -- Player 2
  UPDATE users 
  SET 
    lp = lp + v_player2_lp_award,
    rating = GREATEST(0, rating + v_player2_rating_change),
    total_games = total_games + 1,
    total_wins = CASE WHEN p_winner_id = v_player2_id THEN total_wins + 1 ELSE total_wins END,
    total_losses = CASE WHEN p_winner_id != v_player2_id AND p_winner_id IS NOT NULL THEN total_losses + 1 ELSE total_losses END,

    -- NEW: Update specific Arena stats
    arena_total_games = COALESCE(arena_total_games, 0) + 1,
    arena_wins = COALESCE(arena_wins, 0) + (CASE WHEN p_winner_id = v_player2_id THEN 1 ELSE 0 END)
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

-- Make sure we also update award_room_rewards for Rooms to match (if they play 1v1 in room)
CREATE OR REPLACE FUNCTION award_room_rewards(p_room_id UUID)
RETURNS VOID AS $$
DECLARE
  v_room rooms%ROWTYPE;
  v_participant RECORD;
  v_rank INT := 0;
  v_lp_award INT;
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
    
    -- ADJUSTED REWARDS
    -- Tournament: High stakes (50/25/10)
    -- Arena/TurnBased (Casual Room): Lower stakes (10/5/0)? Or keep high?
    -- User complained about 25 for loser.
    -- If room has >2 players, 25 for 2nd is fine (it's podium).
    -- If room has 2 players, 2nd is loser.
    -- We can check participant count?
    -- For now, let's keep Tournament high, but reduce others if needed.
    -- Or just stick to: 1st=50, 2nd=25, 3rd=10 DEFAULT.
    -- The user explicitly mentioned "hızlı oyun" (1v1). The above function handles 1v1.
    -- This function handles ROOMS (Custom/Tournament).
    -- I will keep rooms rewarding as is, but maybe ensure 2nd place in a 2-player game doesn't feel like a 'win' if that's the issue?
    -- Actually, 25 LP is nice for 2nd place.
    -- I will leave this function mostly as is but ensure stats map correctly.
    
    IF v_rank = 1 THEN v_lp_award := 50;
    ELSIF v_rank = 2 THEN v_lp_award := 25;
    ELSE v_lp_award := 10;
    END IF;

    UPDATE users SET
        lp = lp + v_lp_award,
        total_score = total_score + v_participant.score, -- Ensure Score Sync
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
