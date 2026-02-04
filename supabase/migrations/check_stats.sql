-- Check Tournament and detailed stats for all users
SELECT 
    username, 
    email, 
    total_score,
    -- Tournament Stats
    tournament_wins AS "1.likler",
    tournament_2nd AS "2.likler",
    tournament_3rd AS "3.lükler",
    tournament_total_games AS "Toplam Turnuva",
    
    -- Elo
    rating,
    
    -- Other
    arena_wins,
    turn_based_wins,
    lp AS "Mevcut LP"
FROM users
ORDER BY tournament_wins DESC;
