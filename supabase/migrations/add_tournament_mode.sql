-- Migration: Add Tournament Mode Support
-- Run this in Supabase SQL Editor

-- 1. Update rooms.game_mode to support 'tournament'
-- First, fix any existing invalid game_mode values
UPDATE rooms 
SET game_mode = 'arena' 
WHERE game_mode IS NULL OR game_mode NOT IN ('arena', 'turn_based');

-- Drop the existing constraint if it exists
ALTER TABLE rooms DROP CONSTRAINT IF EXISTS rooms_game_mode_check;

-- Add the new constraint with 'tournament' included
ALTER TABLE rooms ADD CONSTRAINT rooms_game_mode_check 
  CHECK (game_mode IN ('arena', 'turn_based', 'tournament'));

-- 2. Tournament Lobby Table (for team play)
CREATE TABLE IF NOT EXISTS tournament_lobbies (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  lobby_code TEXT UNIQUE NOT NULL,
  leader_id UUID REFERENCES users(id) ON DELETE CASCADE,
  game_mode TEXT NOT NULL CHECK (game_mode IN ('arena', 'turn_based')),
  status TEXT NOT NULL DEFAULT 'waiting' CHECK (status IN ('waiting', 'searching', 'matched')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3. Lobby Members
CREATE TABLE IF NOT EXISTS tournament_lobby_members (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  lobby_id UUID REFERENCES tournament_lobbies(id) ON DELETE CASCADE,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  joined_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(lobby_id, user_id)
);

-- 4. Tournament Matchmaking Queue
CREATE TABLE IF NOT EXISTS tournament_queue (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  lobby_id UUID REFERENCES tournament_lobbies(id) ON DELETE CASCADE,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  game_mode TEXT NOT NULL CHECK (game_mode IN ('arena', 'turn_based')),
  is_team BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  CHECK (
    (lobby_id IS NOT NULL AND is_team = true AND user_id IS NULL) OR 
    (user_id IS NOT NULL AND is_team = false AND lobby_id IS NULL)
  )
);

-- 5. Tournament Waiting Rooms (for countdown logic)
CREATE TABLE IF NOT EXISTS tournament_waiting_rooms (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  room_id UUID REFERENCES rooms(id) ON DELETE CASCADE,
  game_mode TEXT NOT NULL CHECK (game_mode IN ('arena', 'turn_based')),
  min_players INTEGER NOT NULL,
  max_players INTEGER NOT NULL,
  current_players INTEGER DEFAULT 0,
  countdown_started_at TIMESTAMP WITH TIME ZONE,
  status TEXT DEFAULT 'filling' CHECK (status IN ('filling', 'countdown', 'started')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS for new tables
ALTER TABLE tournament_lobbies ENABLE ROW LEVEL SECURITY;
ALTER TABLE tournament_lobby_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE tournament_queue ENABLE ROW LEVEL SECURITY;
ALTER TABLE tournament_waiting_rooms ENABLE ROW LEVEL SECURITY;

-- RLS Policies for tournament_lobbies
CREATE POLICY "Anyone can view lobbies" ON tournament_lobbies FOR SELECT USING (true);
CREATE POLICY "Users can create lobbies" ON tournament_lobbies FOR INSERT WITH CHECK (auth.uid() = leader_id);
CREATE POLICY "Leader can update lobby" ON tournament_lobbies FOR UPDATE USING (auth.uid() = leader_id);
CREATE POLICY "Leader can delete lobby" ON tournament_lobbies FOR DELETE USING (auth.uid() = leader_id);

-- RLS Policies for tournament_lobby_members
CREATE POLICY "Anyone can view lobby members" ON tournament_lobby_members FOR SELECT USING (true);
CREATE POLICY "Users can join lobbies" ON tournament_lobby_members FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can leave lobbies" ON tournament_lobby_members FOR DELETE USING (auth.uid() = user_id);

-- RLS Policies for tournament_queue
CREATE POLICY "Users can view queue" ON tournament_queue FOR SELECT USING (true);
CREATE POLICY "Users can join queue" ON tournament_queue FOR INSERT WITH CHECK (
  auth.uid() = user_id OR 
  EXISTS (SELECT 1 FROM tournament_lobbies WHERE id = lobby_id AND leader_id = auth.uid())
);
CREATE POLICY "Users can leave queue" ON tournament_queue FOR DELETE USING (
  auth.uid() = user_id OR 
  EXISTS (SELECT 1 FROM tournament_lobbies WHERE id = lobby_id AND leader_id = auth.uid())
);

-- RLS Policies for tournament_waiting_rooms
CREATE POLICY "Anyone can view waiting rooms" ON tournament_waiting_rooms FOR SELECT USING (true);

-- Add to realtime publication
ALTER PUBLICATION supabase_realtime ADD TABLE tournament_lobbies;
ALTER PUBLICATION supabase_realtime ADD TABLE tournament_lobby_members;
ALTER PUBLICATION supabase_realtime ADD TABLE tournament_queue;
ALTER PUBLICATION supabase_realtime ADD TABLE tournament_waiting_rooms;

-- Function: Generate lobby code
CREATE OR REPLACE FUNCTION generate_lobby_code()
RETURNS TEXT AS $$
DECLARE
  chars TEXT := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; -- Removed confusing chars
  result TEXT := '';
  i INTEGER := 0;
BEGIN
  FOR i IN 1..6 LOOP
    result := result || substr(chars, floor(random() * length(chars) + 1)::integer, 1);
  END LOOP;
  RETURN result;
END;
$$ LANGUAGE plpgsql;

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_tournament_queue_game_mode ON tournament_queue(game_mode, created_at);
CREATE INDEX IF NOT EXISTS idx_tournament_waiting_rooms_status ON tournament_waiting_rooms(status, game_mode);
CREATE INDEX IF NOT EXISTS idx_tournament_lobbies_code ON tournament_lobbies(lobby_code);
