-- Revised finish_room function to handle detailed statistics

CREATE OR REPLACE FUNCTION finish_room(room_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    r RECORD;
    p RECORD;
    winner_id UUID;
BEGIN
    -- Get room details
    SELECT * INTO r FROM rooms WHERE id = room_id;
    IF NOT FOUND THEN RETURN; END IF;

    -- Update room status
    UPDATE rooms SET status = 'finished', ended_at = NOW() WHERE id = room_id;
    UPDATE room_participants SET status = 'finished' WHERE room_id = room_id;

    -- Calculate Stats based on Game Mode
    
    -- 1. WORD RACE / ARENA (Multiplayer)
    IF r.game_mode = 'word_race' OR r.game_mode = 'arena' THEN
        -- Loop through players to update stats using cursor directly
        


        -- Loop through players to update stats
        -- We need to cast the json back to record or just access fields if possible.
        -- PLPGSQL arrays of records are tricky. Let's use a cursor loop instead.
        
        DECLARE
            rank INTEGER := 1;
            player_cursor CURSOR FOR 
                SELECT * FROM room_participants 
                WHERE room_id = room_id 
                ORDER BY score DESC, finished_at ASC NULLS LAST;
        BEGIN
            FOR p IN player_cursor LOOP
                -- Determine outcome string
                DECLARE 
                    outcome TEXT := 'participation';
                BEGIN
                    IF r.game_mode = 'arena' THEN
                        -- Arena Logic (usually 1v1 or small group, quick game)
                        -- If rank 1 -> Win, else Loss (simplified for 1v1 arena)
                        -- If >2 players, maybe top half? Let's assume Rank 1 is winner for now.
                        IF rank = 1 THEN
                            outcome := 'win';
                        ELSE
                            outcome := 'loss';
                        END IF;
                        
                        PERFORM update_user_stats(p.user_id, 'quick', outcome, 0); -- Score already updated live? If not, add p.score here.
                        
                    ELSIF r.game_mode = 'tournament' THEN
                        -- Tournament Logic
                        IF rank = 1 THEN outcome := '1st';
                        ELSIF rank = 2 THEN outcome := '2nd';
                        ELSIF rank = 3 THEN outcome := '3rd';
                        END IF;
                        
                        PERFORM update_user_stats(p.user_id, 'tournament', outcome, 0);
                    ELSE 
                        -- Word Race Default (Treat as Quick if not specified?)
                         IF rank = 1 THEN
                            outcome := 'win';
                        ELSE
                            outcome := 'loss';
                        END IF;
                        PERFORM update_user_stats(p.user_id, 'quick', outcome, 0);
                    END IF;
                END;
                
                rank := rank + 1;
            END LOOP;
        END;
    
    -- 2. TURN BASED (1v1 Friends) - Logic might be separate, but if handled here:
    ELSIF r.game_mode = 'turn_based' THEN
         -- Turn based games usually end when a score limit is reached or one resigns.
         -- If this function is called, it means game is over.
         -- Determine winner by score.
         
        DECLARE
            p1 RECORD;
            p2 RECORD;
        BEGIN
            SELECT * INTO p1 FROM room_participants WHERE room_id = room_id ORDER BY created_at ASC LIMIT 1;
            SELECT * INTO p2 FROM room_participants WHERE room_id = room_id ORDER BY created_at DESC LIMIT 1;
            
            IF p1.user_id IS NOT NULL AND p2.user_id IS NOT NULL THEN
                IF p1.score > p2.score THEN
                    PERFORM update_user_stats(p1.user_id, '1v1', 'win', 0);
                    PERFORM update_user_stats(p2.user_id, '1v1', 'loss', 0);
                ELSIF p2.score > p1.score THEN
                    PERFORM update_user_stats(p2.user_id, '1v1', 'win', 0);
                    PERFORM update_user_stats(p1.user_id, '1v1', 'loss', 0);
                ELSE
                    -- Draw? Currently no draw stat, maybe count as nothing or both loss? 
                    -- Let's do nothing for draw for separate stats, or both participation.
                    NULL; 
                END IF;
            END IF;
        END;
    END IF;

END;
$$;
