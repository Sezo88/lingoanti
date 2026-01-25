-- Migration to add detailed statistics columns to users table

ALTER TABLE users
ADD COLUMN IF NOT EXISTS wins_quick INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS losses_quick INTEGER DEFAULT 0,

ADD COLUMN IF NOT EXISTS wins_1v1 INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS losses_1v1 INTEGER DEFAULT 0,

ADD COLUMN IF NOT EXISTS tournament_1st INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS tournament_2nd INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS tournament_3rd INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS tournaments_played INTEGER DEFAULT 0;

-- Helper function to update stats in a unified way
CREATE OR REPLACE FUNCTION update_user_stats(
    p_user_id UUID,
    p_game_type TEXT, -- 'quick', '1v1', 'tournament'
    p_result TEXT,    -- 'win', 'loss', '1st', '2nd', '3rd', 'participation'
    p_score_delta INTEGER DEFAULT 0    -- Standard score update
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    -- 1. Standard Score Update (Global Rank)
    UPDATE users 
    SET score = score + p_score_delta,
        total_games = total_games + 1
    WHERE id = p_user_id;

    -- 2. Specific Stats Update
    IF p_game_type = 'quick' THEN
        IF p_result = 'win' THEN
            UPDATE users SET wins_quick = wins_quick + 1, wins = wins + 1 WHERE id = p_user_id;
        ELSIF p_result = 'loss' THEN
            UPDATE users SET losses_quick = losses_quick + 1, losses = losses + 1 WHERE id = p_user_id;
        END IF;

    ELSIF p_game_type = '1v1' THEN
        IF p_result = 'win' THEN
            UPDATE users SET wins_1v1 = wins_1v1 + 1, wins = wins + 1 WHERE id = p_user_id;
        ELSIF p_result = 'loss' THEN
            UPDATE users SET losses_1v1 = losses_1v1 + 1, losses = losses + 1 WHERE id = p_user_id;
        END IF;

    ELSIF p_game_type = 'tournament' THEN
        UPDATE users SET tournaments_played = tournaments_played + 1 WHERE id = p_user_id;
        
        IF p_result = '1st' THEN
            UPDATE users SET tournament_1st = tournament_1st + 1, wins = wins + 1 WHERE id = p_user_id;
        ELSIF p_result = '2nd' THEN
            UPDATE users SET tournament_2nd = tournament_2nd + 1 WHERE id = p_user_id;
        ELSIF p_result = '3rd' THEN
            UPDATE users SET tournament_3rd = tournament_3rd + 1 WHERE id = p_user_id;
        END IF;
    END IF;
END;
$$;
