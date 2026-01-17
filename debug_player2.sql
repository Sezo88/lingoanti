-- Inspect room state to debug player 2 issue
SELECT 
    id,
    code,
    status,
    config->>'currentTurn' as current_turn,
    config->'turnOrder' as turn_order,
    game_state->'guesses' as guesses,
    jsonb_array_length(game_state->'guesses') as guess_count,
    jsonb_array_length(game_state->'results') as result_count
FROM rooms 
WHERE status = 'playing' 
ORDER BY created_at DESC 
LIMIT 1;
