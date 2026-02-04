-- Function to distribute tickets to all users
CREATE OR REPLACE FUNCTION distribute_tickets_all(amount int)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Update all users' ticket count
  UPDATE public.users
  SET tickets = COALESCE(tickets, 0) + amount;
END;
$$;

-- Function to distribute coins to all users
CREATE OR REPLACE FUNCTION distribute_coins_all(amount int)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Update all users' coin count
  UPDATE public.users
  SET coins = COALESCE(coins, 0) + amount;
END;
$$;
