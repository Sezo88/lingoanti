-- CRITICAL FIX: Sync LPara Rewards to user_currency table

-- 1. Finish Game Trigger (Updates BOTH users.lp and user_currency.tickets)
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
BEGIN
  -- Lock Game
  SELECT * INTO v_game FROM games WHERE id = p_game_id FOR UPDATE;
  
  IF NOT FOUND THEN RETURN jsonb_build_object('success', false, 'error', 'Game not found'); END IF;
  IF v_game.status = 'finished' THEN RETURN jsonb_build_object('success', false, 'error', 'Game already finished'); END IF;

  v_player1_id := v_game.player1_id;
  v_player2_id := v_game.player2_id;

  -- Rewards Definition
  -- LP/Tickets: Currency (For Jokers) -> Win: 10, Loss: 0
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

  -- Update Player 1 (Stats)
  UPDATE users 
  SET 
    lp = lp + v_player1_lp_award, -- Keep legacy LP column in sync just in case
    rating = GREATEST(0, rating + v_player1_rating_change),
    total_score = total_score + COALESCE(v_game.player1_score, 0) + v_player1_score_award,
    total_games = total_games + 1,
    total_wins = CASE WHEN p_winner_id = v_player1_id THEN total_wins + 1 ELSE total_wins END,
    total_losses = CASE WHEN p_winner_id != v_player1_id AND p_winner_id IS NOT NULL THEN total_losses + 1 ELSE total_losses END,
    arena_total_games = COALESCE(arena_total_games, 0) + 1,
    arena_wins = COALESCE(arena_wins, 0) + (CASE WHEN p_winner_id = v_player1_id THEN 1 ELSE 0 END)
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
    arena_total_games = COALESCE(arena_total_games, 0) + 1,
    arena_wins = COALESCE(arena_wins, 0) + (CASE WHEN p_winner_id = v_player2_id THEN 1 ELSE 0 END)
  WHERE id = v_player2_id;

  -- CRITICAL: Update user_currency TICKETS (Real LPara)
  -- Player 1
  UPDATE user_currency 
  SET tickets = tickets + v_player1_lp_award, updated_at = NOW()
  WHERE user_id = v_player1_id;

  -- Player 2
  UPDATE user_currency 
  SET tickets = tickets + v_player2_lp_award, updated_at = NOW()
  WHERE user_id = v_player2_id;

  -- Mark Finished
  UPDATE games SET status = 'finished', winner_id = p_winner_id, finished_at = NOW() WHERE id = p_game_id;

  RETURN jsonb_build_object('success', true);
EXCEPTION WHEN others THEN
  RETURN jsonb_build_object('success', false, 'error', SQLERRM);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- 3. Room Rewards (Sync user_currency)
CREATE OR REPLACE FUNCTION award_room_rewards(p_room_id UUID)
RETURNS VOID AS $$
DECLARE
  v_room rooms%ROWTYPE;
  v_participant RECORD;
  v_rank INT := 0;
  v_lp_award INT;
  v_score_award INT;
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
    
    IF v_rank = 1 THEN 
        v_lp_award := 50; v_score_award := 100;
    ELSIF v_rank = 2 THEN 
        v_lp_award := 25; v_score_award := 50;
    ELSIF v_rank = 3 THEN 
        v_lp_award := 10; v_score_award := 25;
    ELSE 
        v_lp_award := 5; v_score_award := 10;
    END IF;

    -- Update Stats
    UPDATE users SET
        lp = lp + v_lp_award,
        total_score = total_score + v_participant.score + v_score_award,
        total_games = total_games + 1,
        total_wins = total_wins + (CASE WHEN v_rank = 1 THEN 1 ELSE 0 END),
        tournament_wins = tournament_wins + (CASE WHEN v_mode = 'tournament' AND v_rank = 1 THEN 1 ELSE 0 END),
        arena_wins = arena_wins + (CASE WHEN v_mode = 'arena' AND v_rank = 1 THEN 1 ELSE 0 END)
    WHERE id = v_participant.user_id;

    -- Update Currency (LPara)
    UPDATE user_currency 
    SET tickets = tickets + v_lp_award, updated_at = NOW()
    WHERE user_id = v_participant.user_id;

  END LOOP;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
