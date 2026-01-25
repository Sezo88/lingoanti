-- Fix Foreign Key to reference public.users instead of auth.users
-- This allows PostgREST to automatically detect the relationship.

-- Drop table and recreate is cleanest since we know it's empty/new
DROP TABLE IF EXISTS blocked_users;

CREATE TABLE blocked_users (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES public.users(id) ON DELETE CASCADE NOT NULL,
    blocked_user_id UUID REFERENCES public.users(id) ON DELETE CASCADE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    UNIQUE(user_id, blocked_user_id)
);

-- RLS
ALTER TABLE blocked_users ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own blocked users"
    ON blocked_users FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Users can insert into their blocked list"
    ON blocked_users FOR INSERT
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can remove from their blocked list"
    ON blocked_users FOR DELETE
    USING (auth.uid() = user_id);

-- Helper function
CREATE OR REPLACE FUNCTION is_blocked(blocker uuid, target uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
AS $$
  SELECT EXISTS (
    SELECT 1 FROM blocked_users 
    WHERE user_id = blocker AND blocked_user_id = target
  );
$$;
