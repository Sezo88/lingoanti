-- Create a new RPC to get full profile with new stats mapping
CREATE OR REPLACE FUNCTION get_full_user_profile(
    target_user_id UUID,
    requesting_user_id UUID
)
RETURNS TABLE (
    user_id UUID,
    username TEXT,
    display_name TEXT,
    avatar_id INTEGER,
    email TEXT,
    created_at TIMESTAMP WITH TIME ZONE,
    total_score INTEGER,
    total_wins INTEGER,
    total_losses INTEGER,
    total_games INTEGER,
    win_rate NUMERIC,
    longest_win_streak INTEGER,
    privacy_settings JSONB,
    is_own_profile BOOLEAN,
    -- Mapped Stats
    wins_quick INTEGER,
    losses_quick INTEGER,
    wins_1v1 INTEGER,
    losses_1v1 INTEGER,
    tournament_1st INTEGER,
    tournament_2nd INTEGER,
    tournament_3rd INTEGER,
    tournaments_played INTEGER
) AS $$
DECLARE
    v_privacy JSONB;
    v_show_stats BOOLEAN;
    v_is_own BOOLEAN;
    v_user users%ROWTYPE;
BEGIN
    SELECT * INTO v_user FROM users WHERE id = target_user_id;
    
    IF NOT FOUND THEN RETURN; END IF;

    v_is_own := (target_user_id = requesting_user_id);
    v_privacy := v_user.privacy_settings;
    
    -- Default privacy if null
    IF v_privacy IS NULL THEN
        v_privacy := '{"show_email": false, "show_stats": true}'::jsonb;
    END IF;

    v_show_stats := (v_privacy->>'show_stats')::BOOLEAN;
    IF v_show_stats IS NULL THEN v_show_stats := true; END IF;

    -- If not own profile and stats hidden, return nulls for stats
    IF NOT v_is_own AND NOT v_show_stats THEN
        RETURN QUERY SELECT
            v_user.id,
            v_user.username,
            v_user.display_name,
            v_user.avatar_id,
            CASE WHEN (v_privacy->>'show_email')::BOOLEAN THEN v_user.email ELSE NULL END,
            v_user.created_at,
            NULL::INTEGER as total_score,
            NULL::INTEGER as total_wins,
            NULL::INTEGER as total_losses,
            NULL::INTEGER as total_games,
            NULL::NUMERIC as win_rate,
            NULL::INTEGER as longest_win_streak,
            v_privacy,
            v_is_own,
            -- Detailed Nulls
            NULL::INTEGER, NULL::INTEGER, -- Quick
            NULL::INTEGER, NULL::INTEGER, -- 1v1
            NULL::INTEGER, NULL::INTEGER, NULL::INTEGER, NULL::INTEGER; -- Tournament
    ELSE
        RETURN QUERY SELECT
            v_user.id,
            v_user.username,
            v_user.display_name,
            v_user.avatar_id,
            CASE WHEN v_is_own OR (v_privacy->>'show_email')::BOOLEAN THEN v_user.email ELSE NULL END,
            v_user.created_at,
            v_user.total_score,
            v_user.total_wins,
            v_user.total_losses,
            v_user.total_games,
            CASE WHEN v_user.total_games > 0 
                 THEN ROUND( (v_user.total_wins::NUMERIC / v_user.total_games::NUMERIC) * 100, 1)
                 ELSE 0 END as win_rate,
            v_user.longest_win_streak,
            v_privacy,
            v_is_own,
            -- Mapping New Stats to Interface Names
            v_user.arena_wins as wins_quick,
            (v_user.arena_total_games - v_user.arena_wins) as losses_quick, -- Approximate losses
            
            v_user.turn_based_wins as wins_1v1,
            (v_user.turn_based_total_games - v_user.turn_based_wins) as losses_1v1,
            
            v_user.tournament_wins as tournament_1st,
            0 as tournament_2nd, -- Not currently tracking 2nd/3rd places in dedicated columns
            0 as tournament_3rd, 
            v_user.tournament_total_games as tournaments_played;
    END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
