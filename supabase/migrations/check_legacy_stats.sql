-- CHECK LEGACY STATS & GAME MODES

-- 1. See what Game Modes actually exist in the games table
SELECT DISTINCT game_mode FROM games;

-- 2. Check the specific stats columns for a few active users
SELECT 
    username, 
    wins_1v1, losses_1v1, 
    wins_quick, losses_quick, 
    arena_wins, arena_total_games,
    tournament_wins
FROM users 
ORDER BY total_games DESC 
LIMIT 5;
