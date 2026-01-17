-- Get target word and recent guesses for the active room to prove correctness
SELECT 
    id,
    code,
    (game_words->>(game_state->>'currentWordIndex')::int) as target_word,
    game_state->'guesses' as guesses
FROM rooms 
WHERE status = 'playing' 
ORDER BY created_at DESC 
LIMIT 1;
