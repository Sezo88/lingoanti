-- Create a function to atomically advance the game round
-- This prevents race conditions and ensures round_message is cleared properly
-- NOW WITH OPTIMISTIC LOCKING: p_expected_round
CREATE OR REPLACE FUNCTION advance_game_round(p_game_id UUID, p_expected_round INTEGER)
RETURNS JSON AS $$
DECLARE
    v_game games%ROWTYPE;
    v_new_length INTEGER;
    v_new_word TEXT;
    v_next_starter UUID;
BEGIN
    -- 1. LOCK the game row for update to prevent race conditions
    SELECT * INTO v_game FROM games WHERE id = p_game_id FOR UPDATE;

    IF NOT FOUND THEN
        RETURN json_build_object('success', false, 'error', 'Game not found');
    END IF;

    -- Safety: If game is already finished, do nothing
    IF v_game.status = 'finished' THEN
        RETURN json_build_object('success', false, 'error', 'Game is finished');
    END IF;

    -- CRITICAL OPTIMISTIC LOCK: Check if round matches expected
    IF v_game.current_round != p_expected_round THEN
         -- Soft fail: Round already advanced by someone else (or double trigger)
         -- Return success=true because the goal "advance round" WAS achieved (just not by this specific call)
         RETURN json_build_object(
            'success', true, 
            'new_round', v_game.current_round, 
            'message', 'Round already advanced'
         );
    END IF;

    -- 2. Determine new word length
    IF v_game.mixed_mode THEN
        v_new_length := FLOOR(RANDOM() * 4) + 4; -- 4-7
    ELSE
        v_new_length := v_game.word_length;
    END IF;

    -- 3. Select a new random word from game_words table
    -- Fallback safety: If no word found (rare), loop until found or error
    SELECT word INTO v_new_word 
    FROM game_words 
    WHERE length = v_new_length 
    ORDER BY RANDOM() 
    LIMIT 1;

    IF v_new_word IS NULL THEN
         RETURN json_build_object('success', false, 'error', 'No word found for length ' || v_new_length);
    END IF;

    -- 4. Determine next starter (Alternating Turns)
    -- Current round is v_game.current_round. New round will be +1.
    -- Round 1 (Odd) -> Player 1 started.
    -- Round 2 (Even) -> Player 2 starts.
    -- Round 3 (Odd) -> Player 1 starts.
    IF (v_game.current_round + 1) % 2 = 1 THEN
        v_next_starter := v_game.player1_id;
    ELSE
        v_next_starter := v_game.player2_id;
    END IF;

    -- 5. UPDATE the game atomically
    UPDATE games 
    SET 
        current_round = current_round + 1,
        target_word = v_new_word,
        word_length = v_new_length,
        current_turn = v_next_starter,
        round_message = NULL,      -- CRITICAL: Clear the message
        turn_started_at = NULL,    -- Reset timer so new round starts fresh (client will trigger start)
        updated_at = NOW()
    WHERE id = p_game_id;

    RETURN json_build_object(
        'success', true,
        'new_round', v_game.current_round + 1,
        'new_word', v_new_word,
        'starter', v_next_starter
    );

EXCEPTION WHEN others THEN
    RETURN json_build_object('success', false, 'error', SQLERRM);
END;
$$ LANGUAGE plpgsql;
