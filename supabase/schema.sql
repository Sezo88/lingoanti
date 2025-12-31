-- Supabase veritabanı tablolarını oluşturmak için SQL

-- UUID extension'ı etkinleştir
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Users tablosu
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  email TEXT UNIQUE NOT NULL,
  username TEXT UNIQUE NOT NULL,
  display_name TEXT NOT NULL,
  avatar_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  last_seen TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Friendships tablosu
CREATE TABLE IF NOT EXISTS friendships (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  friend_id UUID REFERENCES users(id) ON DELETE CASCADE,
  status TEXT CHECK (status IN ('pending', 'accepted')) DEFAULT 'pending',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id, friend_id)
);

-- Words tablosu
CREATE TABLE IF NOT EXISTS words (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  word TEXT NOT NULL,
  length INTEGER NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Word index for faster queries
CREATE INDEX IF NOT EXISTS idx_words_length ON words(length);
CREATE INDEX IF NOT EXISTS idx_words_word ON words(word);

-- Games tablosu
CREATE TABLE IF NOT EXISTS games (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    player1_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    player2_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    word_length INTEGER NOT NULL CHECK (word_length >= 4 AND word_length <= 10),
    target_word TEXT NOT NULL,
    current_turn UUID REFERENCES users(id),
    status TEXT NOT NULL DEFAULT 'waiting' CHECK (status IN ('waiting', 'active', 'finished')),
    winner_id UUID REFERENCES users(id),
    best_of INTEGER NOT NULL DEFAULT 1 CHECK (best_of IN (1, 3, 5, 7)),
    current_round INTEGER NOT NULL DEFAULT 1,
    player1_score INTEGER NOT NULL DEFAULT 0,
    player2_score INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    finished_at TIMESTAMPTZ
);

-- Game moves tablosu
CREATE TABLE IF NOT EXISTS game_moves (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  game_id UUID REFERENCES games(id) ON DELETE CASCADE,
  player_id UUID REFERENCES users(id) ON DELETE CASCADE,
  guess TEXT NOT NULL,
  result JSONB NOT NULL,
  move_number INTEGER NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for better performance
CREATE INDEX IF NOT EXISTS idx_games_status ON games(status);
CREATE INDEX IF NOT EXISTS idx_games_players ON games(player1_id, player2_id);
CREATE INDEX IF NOT EXISTS idx_game_moves_game ON game_moves(game_id);

-- Row Level Security (RLS) Policies

-- Enable RLS
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE friendships ENABLE ROW LEVEL SECURITY;
ALTER TABLE words ENABLE ROW LEVEL SECURITY;
ALTER TABLE games ENABLE ROW LEVEL SECURITY;
ALTER TABLE game_moves ENABLE ROW LEVEL SECURITY;

-- Users policies
CREATE POLICY "Users can view all users" ON users FOR SELECT USING (true);
CREATE POLICY "Users can update own profile" ON users FOR UPDATE USING (auth.uid() = id);
CREATE POLICY "Users can insert own profile" ON users FOR INSERT WITH CHECK (auth.uid() = id);


-- Friendships policies
CREATE POLICY "Users can view own friendships" ON friendships FOR SELECT 
  USING (auth.uid() = user_id OR auth.uid() = friend_id);
CREATE POLICY "Users can create friendships" ON friendships FOR INSERT 
  WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own friendship requests" ON friendships FOR UPDATE 
  USING (auth.uid() = user_id OR auth.uid() = friend_id);
CREATE POLICY "Users can delete own friendships" ON friendships FOR DELETE 
  USING (auth.uid() = user_id OR auth.uid() = friend_id);

-- Words policies (everyone can read)
CREATE POLICY "Anyone can view words" ON words FOR SELECT USING (true);
CREATE POLICY "Allow insert words" ON words FOR INSERT WITH CHECK (true);


-- Games policies
CREATE POLICY "Users can view own games" ON games FOR SELECT 
  USING (auth.uid() = player1_id OR auth.uid() = player2_id);
CREATE POLICY "Users can create games" ON games FOR INSERT 
  WITH CHECK (auth.uid() = player1_id);
CREATE POLICY "Players can update own games" ON games FOR UPDATE 
  USING (auth.uid() = player1_id OR auth.uid() = player2_id);

-- Game moves policies
CREATE POLICY "Users can view game moves" ON game_moves FOR SELECT 
  USING (
    EXISTS (
      SELECT 1 FROM games 
      WHERE games.id = game_moves.game_id 
      AND (games.player1_id = auth.uid() OR games.player2_id = auth.uid())
    )
  );
CREATE POLICY "Users can insert own moves" ON game_moves FOR INSERT 
  WITH CHECK (auth.uid() = player_id);

-- Real-time için publication oluştur
ALTER PUBLICATION supabase_realtime ADD TABLE games;
ALTER PUBLICATION supabase_realtime ADD TABLE game_moves;
ALTER PUBLICATION supabase_realtime ADD TABLE friendships;
