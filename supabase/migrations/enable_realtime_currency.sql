-- Enable Realtime for user_currency table
BEGIN;

-- Check if publication exists (standard supabase setup), if so add table
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE user_currency;
  END IF;
END
$$;

COMMIT;
