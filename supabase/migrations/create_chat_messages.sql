-- Create chat_messages table
CREATE TABLE IF NOT EXISTS chat_messages (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    room_id UUID REFERENCES rooms(id) ON DELETE CASCADE, -- Auto-delete if room is deleted
    game_id UUID REFERENCES games(id) ON DELETE CASCADE, -- Auto-delete if game is deleted
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    message TEXT NOT NULL CHECK (char_length(message) > 0 AND char_length(message) <= 500),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE chat_messages ENABLE ROW LEVEL SECURITY;

-- Enable Realtime for this table
ALTER PUBLICATION supabase_realtime ADD TABLE chat_messages;

-- Policies

-- 1. SELECT (Read)
-- Users can see messages if they are in the room OR in the game
CREATE POLICY "View messages" ON chat_messages
FOR SELECT
USING (
    (room_id IS NOT NULL AND EXISTS (
        SELECT 1 FROM room_participants 
        WHERE room_id = chat_messages.room_id 
        AND user_id = auth.uid()
        AND status IN ('active', 'playing', 'ready')
    ))
    OR
    (game_id IS NOT NULL AND EXISTS (
        SELECT 1 FROM games 
        WHERE id = chat_messages.game_id 
        AND (player1_id = auth.uid() OR player2_id = auth.uid())
    ))
);

-- 2. INSERT (Write)
-- Users can send messages if they are in the room OR in the game
CREATE POLICY "Send messages" ON chat_messages
FOR INSERT
WITH CHECK (
    auth.uid() = user_id -- Can only send as yourself
    AND (
        (room_id IS NOT NULL AND EXISTS (
            SELECT 1 FROM room_participants 
            WHERE room_id = chat_messages.room_id 
            AND user_id = auth.uid()
        ))
        OR
        (game_id IS NOT NULL AND EXISTS (
            SELECT 1 FROM games 
            WHERE id = chat_messages.game_id 
            AND (player1_id = auth.uid() OR player2_id = auth.uid())
        ))
    )
);

-- Add Index for performance
CREATE INDEX IF NOT EXISTS idx_chat_room_id ON chat_messages(room_id);
CREATE INDEX IF NOT EXISTS idx_chat_game_id ON chat_messages(game_id);
