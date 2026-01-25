-- Check all active playing rooms
SELECT 
    id, 
    code, 
    game_mode, 
    status, 
    created_at, 
    NOW() - created_at as duration
FROM rooms 
WHERE status = 'playing'
ORDER BY created_at ASC;
