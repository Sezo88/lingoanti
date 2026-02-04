-- DIAGNOSE: List all columns in users table to identify correct stat columns
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'users'
ORDER BY ordinal_position;

-- CHECK GAMES
SELECT id, status, game_mode, created_at, finished_at, player1_id, player2_id 
FROM games 
ORDER BY created_at DESC 
LIMIT 10;
