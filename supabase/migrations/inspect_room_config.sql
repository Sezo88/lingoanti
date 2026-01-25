-- Check room configs for turnOrder
SELECT 
    id, 
    game_mode, 
    status,
    config->'gameMode' as sub_mode,
    config->'turnOrder' as turn_order,
    jsonb_array_length(config->'turnOrder') as turn_count,
    created_at
FROM rooms 
WHERE status = 'playing'
ORDER BY created_at DESC
LIMIT 5;
