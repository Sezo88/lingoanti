-- Ensure Stats Columns Exist in users table
-- Run this if stats are not updating!

DO $$
BEGIN
    -- 1. Arena Stats
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='users' AND column_name='arena_wins') THEN
        ALTER TABLE users ADD COLUMN arena_wins INT DEFAULT 0;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='users' AND column_name='arena_total_games') THEN
        ALTER TABLE users ADD COLUMN arena_total_games INT DEFAULT 0;
    END IF;

    -- 2. Tournament Stats
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='users' AND column_name='tournament_wins') THEN
        ALTER TABLE users ADD COLUMN tournament_wins INT DEFAULT 0;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='users' AND column_name='tournament_total_games') THEN
        ALTER TABLE users ADD COLUMN tournament_total_games INT DEFAULT 0;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='users' AND column_name='tournament_2nd') THEN
        ALTER TABLE users ADD COLUMN tournament_2nd INT DEFAULT 0;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='users' AND column_name='tournament_3rd') THEN
        ALTER TABLE users ADD COLUMN tournament_3rd INT DEFAULT 0;
    END IF;

    -- 3. Turn Based Stats
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='users' AND column_name='turn_based_wins') THEN
        ALTER TABLE users ADD COLUMN turn_based_wins INT DEFAULT 0;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='users' AND column_name='turn_based_total_games') THEN
        ALTER TABLE users ADD COLUMN turn_based_total_games INT DEFAULT 0;
    END IF;

    -- 4. Friend Duel Specific (Optional, if we want to separate it later, but using Arena for now)
    -- IF NOT EXISTS ...
END $$;
