-- Drop the constraint that limits hearts (LBilet) to a maximum (usually 5)
-- This allows Admins to distribute unrestricted amounts of LBilet
ALTER TABLE public.user_currency
DROP CONSTRAINT IF EXISTS user_currency_hearts_check;
