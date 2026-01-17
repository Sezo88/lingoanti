-- Check the detailed structure of game_state for the most recent active room
-- Corrected to use created_at
SELECT 
    id,
    code,
    status,
    config->>'currentTurn' as current_turn,
    game_state
FROM rooms 
WHERE status = 'playing' 
ORDER BY created_at DESC 
LIMIT 1;
