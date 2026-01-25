-- Create blocked_users table
CREATE TABLE IF NOT EXISTS blocked_users (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    blocked_user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    UNIQUE(user_id, blocked_user_id)
);

-- RLS Policies
ALTER TABLE blocked_users ENABLE ROW LEVEL SECURITY;

-- Users can view their own blocked list
CREATE POLICY "Users can view their own blocked users"
    ON blocked_users FOR SELECT
    USING (auth.uid() = user_id);

-- Users can block others
CREATE POLICY "Users can insert into their blocked list"
    ON blocked_users FOR INSERT
    WITH CHECK (auth.uid() = user_id);

-- Users can unblock (delete)
CREATE POLICY "Users can remove from their blocked list"
    ON blocked_users FOR DELETE
    USING (auth.uid() = user_id);

-- Function to check if a user is blocked (helper for other queries)
-- Usage: SELECT is_blocked(user1_id, user2_id)
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

-- Update friend_requests check to prevent blocked users from sending requests
-- (Commented out because friend_requests table does not exist yet)
-- CREATE POLICY "Cannot send friend request if blocked"
--     ON friend_requests FOR INSERT
--     WITH CHECK (
--         NOT EXISTS (
--             SELECT 1 FROM blocked_users
--             WHERE user_id = receiver_id -- receiver has blocked...
--             AND blocked_user_id = auth.uid() -- ...the sender (me)
--         )
--     );
