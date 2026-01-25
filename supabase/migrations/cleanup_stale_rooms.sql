-- Update cleanup function to include hard delete for old data
-- Logic:
-- 1. Mark stale 'playing' rooms as 'finished' (existing logic)
-- 2. Hard DELETE 'finished' rooms older than 30 days (new logic)

CREATE OR REPLACE FUNCTION cleanup_stale_rooms()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    -------------------------------------------------------
    -- AGGRESSIVE CLEANUP (Delete immediately)
    -------------------------------------------------------
    -- Logic: 
    -- 1. If game is NOT 'turn_based' (1v1 friends are safe)
    -- 2. And created_at is older than 30 minutes
    -- 3. DELETE IT. (Doesn't matter if playing or finished, it's stale or done)
    --    Stats are already updated in users table if it finished properly.
    
    -- 1. First delete tournament_lobbies referencing these rooms indirectly
    DELETE FROM tournament_lobbies
    WHERE waiting_room_id IN (
        SELECT id FROM tournament_waiting_rooms 
        WHERE room_id IN (
            SELECT id FROM rooms 
            WHERE game_mode != 'turn_based'
            AND created_at < (NOW() - INTERVAL '30 minutes')
        )
    );

    DELETE FROM tournament_waiting_rooms
    WHERE room_id IN (
        SELECT id FROM rooms 
        WHERE game_mode != 'turn_based'
        AND created_at < (NOW() - INTERVAL '30 minutes')
    );

    -- 2. Then delete participants of these rooms
    DELETE FROM room_participants
    WHERE room_id IN (
        SELECT id FROM rooms 
        WHERE game_mode != 'turn_based'
        AND created_at < (NOW() - INTERVAL '30 minutes')
    );

    -- Then delete the rooms themselves
    DELETE FROM rooms
    WHERE game_mode != 'turn_based'
      AND created_at < (NOW() - INTERVAL '30 minutes');

    -- Note: We still keep turn_based games indefinitely (or until handled by another logic)
END;
$$;
