-- Trigger function to delete chat messages when Game finishes
CREATE OR REPLACE FUNCTION delete_chat_on_finish()
RETURNS TRIGGER AS $$
BEGIN
    -- Check if status changed to 'finished'
    IF NEW.status = 'finished' AND OLD.status != 'finished' THEN
        DELETE FROM chat_messages WHERE game_id = NEW.id;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger for GAMES table
DROP TRIGGER IF EXISTS tr_delete_chat_on_game_finish ON games;
CREATE TRIGGER tr_delete_chat_on_game_finish
AFTER UPDATE ON games
FOR EACH ROW
EXECUTE FUNCTION delete_chat_on_finish();

-- Trigger for ROOMS (if needed)
CREATE OR REPLACE FUNCTION delete_room_chat_on_finish()
RETURNS TRIGGER AS $$
BEGIN
    -- Check if status changed to 'finished' (or room is abandoned)
    IF NEW.status = 'finished' AND OLD.status != 'finished' THEN
        DELETE FROM chat_messages WHERE room_id = NEW.id;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger for ROOMS table
DROP TRIGGER IF EXISTS tr_delete_chat_on_room_finish ON rooms;
CREATE TRIGGER tr_delete_chat_on_room_finish
AFTER UPDATE ON rooms
FOR EACH ROW
EXECUTE FUNCTION delete_room_chat_on_finish();
