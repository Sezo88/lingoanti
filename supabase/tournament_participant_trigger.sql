-- Katılımcı çıkma yönetimi için trigger
-- Bir katılımcı room_participants'tan silindiğinde waiting room'u güncelle

CREATE OR REPLACE FUNCTION handle_participant_leave()
RETURNS TRIGGER AS $$
DECLARE
    v_waiting_room_id UUID;
    v_new_count INTEGER;
    v_min_players INTEGER;
BEGIN
    -- Find associated waiting room
    SELECT id, min_players INTO v_waiting_room_id, v_min_players
    FROM tournament_waiting_rooms
    WHERE room_id = OLD.room_id
      AND status IN ('filling', 'countdown')
    LIMIT 1;

    IF v_waiting_room_id IS NOT NULL THEN
        -- Decrement player count
        UPDATE tournament_waiting_rooms
        SET current_players = GREATEST(0, current_players - 1)
        WHERE id = v_waiting_room_id
        RETURNING current_players INTO v_new_count;

        -- If below minimum, reset countdown
        IF v_new_count < v_min_players THEN
            UPDATE tournament_waiting_rooms
            SET status = 'filling',
                countdown_started_at = NULL
            WHERE id = v_waiting_room_id;
        END IF;
    END IF;

    RETURN OLD;
END;
$$ LANGUAGE plpgsql;

-- Create trigger
DROP TRIGGER IF EXISTS on_participant_leave ON room_participants;
CREATE TRIGGER on_participant_leave
    AFTER DELETE ON room_participants
    FOR EACH ROW
    EXECUTE FUNCTION handle_participant_leave();
