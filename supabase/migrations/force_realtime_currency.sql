-- Force Enable Realtime for user_currency (Fixed Syntax)

-- 1. Set Replica Identity to FULL (Ensures all columns are sent in updates)
ALTER TABLE user_currency REPLICA IDENTITY FULL;

-- 2. Safely Add to Publication
DO $$
BEGIN
  -- Try to ADD the table. If it's already in the publication, it will raise an error/warning depending on version.
  -- We catch the duplicate_object error to allow the script to succeed if it's already added.
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE user_currency;
  EXCEPTION WHEN duplicate_object OR others THEN
    -- Ignore "relation already in publication" errors
    NULL;
  END;
END $$;
