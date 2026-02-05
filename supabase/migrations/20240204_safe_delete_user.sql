-- Function to safely delete ALL data for a user from public tables
-- This ensures no orphaned currency or profile data remains
CREATE OR REPLACE FUNCTION delete_user_data(target_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- 1. Delete user currency/lives data
  DELETE FROM public.user_currency WHERE user_id = target_user_id;

  -- 2. Delete from any other related tables (if you have them, e.g. game history)
  -- DELETE FROM public.games WHERE created_by = target_user_id;
  -- DELETE FROM public.game_participants WHERE user_id = target_user_id;

  -- 3. Finally, delete the user profile from public.users
  DELETE FROM public.users WHERE id = target_user_id;

  -- Note: This does NOT delete from auth.users (login credentials).
  -- That requires Service Role permissions or Cascade setup on auth.users -> public.users
END;
$$;
