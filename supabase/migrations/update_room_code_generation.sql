-- Redefine generate_room_code with ambiguous characters removed
-- Removed: 0, O, 1, I
CREATE OR REPLACE FUNCTION generate_room_code()
RETURNS TEXT AS $$
DECLARE
  -- Allowed characters: A-Z, 0-9 excluding ambiguous ones
  -- Removed: '0', 'O', '1', 'I'
  chars TEXT := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; 
  result TEXT := '';
  i INTEGER := 0;
BEGIN
  FOR i IN 1..6 LOOP
    result := result || substr(chars, floor(random() * length(chars) + 1)::integer, 1);
  END LOOP;
  RETURN result;
END;
$$ LANGUAGE plpgsql;
