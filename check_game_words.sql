-- Inspect game_words for the latest active room
SELECT 
    id,
    code,
    status,
    game_words,
    game_state->>'currentWordIndex' as word_index
FROM rooms 
WHERE status = 'playing' 
ORDER BY created_at DESC 
LIMIT 1;
