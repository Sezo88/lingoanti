-- Create a trigger to automatically send push notifications when a game is created
-- This ensures notifications are sent reliably without depending on client-side code

CREATE OR REPLACE FUNCTION notify_game_invite()
RETURNS TRIGGER AS $$
DECLARE
    inviter_name TEXT;
    invitee_id UUID;
BEGIN
    -- Determine who is being invited (the player who is NOT the creator)
    IF NEW.player1_id = NEW.created_by THEN
        invitee_id := NEW.player2_id;
    ELSE
        invitee_id := NEW.player1_id;
    END IF;

    -- Get the inviter's display name
    SELECT display_name INTO inviter_name
    FROM users
    WHERE id = NEW.created_by;

    -- Call the Edge Function to send the push notification
    -- Using pg_net extension for HTTP requests
    PERFORM
        net.http_post(
            url := current_setting('app.settings.supabase_url') || '/functions/v1/send-push',
            headers := jsonb_build_object(
                'Content-Type', 'application/json',
                'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key')
            ),
            body := jsonb_build_object(
                'targetUserId', invitee_id::text,
                'title', 'Oyun Daveti 🎮',
                'body', COALESCE(inviter_name, 'Arkadaşın') || ' seni oyuna davet etti!',
                'data', jsonb_build_object('gameId', NEW.id::text)
            )
        );

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create the trigger
DROP TRIGGER IF EXISTS on_game_created_notify ON games;
CREATE TRIGGER on_game_created_notify
    AFTER INSERT ON games
    FOR EACH ROW
    WHEN (NEW.status = 'waiting')
    EXECUTE FUNCTION notify_game_invite();

-- Note: This requires pg_net extension to be enabled
-- Run: CREATE EXTENSION IF NOT EXISTS pg_net;
