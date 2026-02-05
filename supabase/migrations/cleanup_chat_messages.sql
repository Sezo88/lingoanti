-- Function to delete old chat messages (older than 24 hours)
CREATE OR REPLACE FUNCTION delete_old_chat_messages()
RETURNS void AS $$
BEGIN
    DELETE FROM chat_messages
    WHERE created_at < NOW() - INTERVAL '24 hours';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Enable pg_cron if not already enabled (Supabase Extension)
-- Note: 'pg_cron' might need to be enabled in Dashboard under Database > Extensions
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Schedule the job to run every hour
SELECT cron.schedule(
    'delete_old_chats', -- Job name
    '0 * * * *',        -- Cron schedule (Every hour at minute 0)
    'SELECT delete_old_chat_messages()'
);

-- OPTIONAL: If pg_cron is not available on the plan, 
-- we can rely on CASCADE delete when Rooms are deleted.
-- But since we don't auto-delete rooms yet (maybe?), this is safer.
