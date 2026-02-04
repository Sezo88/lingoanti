-- Add is_banned column to users table
ALTER TABLE public.users 
ADD COLUMN IF NOT EXISTS is_banned boolean DEFAULT false;

-- Add index for banned users
CREATE INDEX IF NOT EXISTS users_is_banned_idx ON public.users (is_banned);

-- Function to ban/unban user
CREATE OR REPLACE FUNCTION toggle_ban_user(target_user_id uuid, ban_status boolean)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE public.users
  SET is_banned = ban_status
  WHERE id = target_user_id;

  -- Optional: If using Supabase Auth, we might want to revoke sessions too, 
  -- but that requires more complex logic. For now, we just mark the DB record.
  -- The application should check is_banned status on login/middleware.
END;
$$;
