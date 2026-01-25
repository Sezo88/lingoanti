-- Reset all user statistics to initial defaults
UPDATE users
SET 
    -- Support / Currency
    lp = 10000,
    rating = 1000,
    
    -- General Stats
    total_score = 0,
    total_games = 0,
    total_wins = 0,
    total_losses = 0,
    longest_win_streak = 0,
    
    -- Tournament Stats
    tournament_wins = 0,
    tournament_total_games = 0,
    tournament_2nd = 0,
    tournament_3rd = 0,
    
    -- Arena / Quick Game Stats
    arena_wins = 0,
    arena_total_games = 0,
    
    -- Turn Based Stats
    turn_based_wins = 0,
    turn_based_total_games = 0;

-- Optional: If you want to delete match history too (Uncomment to use)
-- DELETE FROM games;
-- DELETE FROM rooms;
