-- "LBilet" Dağıt (Veritabanındaki 'hearts' sütunu)
CREATE OR REPLACE FUNCTION distribute_tickets_all(amount int)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE public.user_currency
  SET hearts = COALESCE(hearts, 0) + amount
  WHERE user_id IS NOT NULL; -- Safety clause to satisfy 'UPDATE requires WHERE'
END;
$$;

-- "LPara" Dağıt (Veritabanındaki 'tickets' sütunu)
CREATE OR REPLACE FUNCTION distribute_coins_all(amount int)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE public.user_currency
  SET tickets = COALESCE(tickets, 0) + amount
  WHERE user_id IS NOT NULL; -- Safety clause to satisfy 'UPDATE requires WHERE'
END;
$$;
