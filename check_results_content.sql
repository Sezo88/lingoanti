-- Inspect the content of results for the latest active room
SELECT 
    id,
    code,
    status,
    game_state->'guesses' as guesses,
    game_state->'results' as results
FROM rooms 
WHERE status = 'playing' 
ORDER BY created_at DESC 
LIMIT 1;
