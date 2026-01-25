-- Enable RLS on room_participants
ALTER TABLE room_participants ENABLE ROW LEVEL SECURITY;

-- Allow anyone to view participants (needed for lobby lists)
DROP POLICY IF EXISTS "Anyone can view room participants" ON room_participants;
CREATE POLICY "Anyone can view room participants" 
ON room_participants FOR SELECT 
USING (true);

-- Allow users to insert themselves (joining)
DROP POLICY IF EXISTS "Users can join rooms" ON room_participants;
CREATE POLICY "Users can join rooms" 
ON room_participants FOR INSERT 
WITH CHECK (auth.uid() = user_id);

-- Allow users to remove themselves (leaving)
DROP POLICY IF EXISTS "Users can leave rooms" ON room_participants;
CREATE POLICY "Users can leave rooms" 
ON room_participants FOR DELETE 
USING (auth.uid() = user_id);
