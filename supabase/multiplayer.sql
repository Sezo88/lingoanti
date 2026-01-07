-- Multiplayer Modu için Veritabanı Şeması

-- 1. Odalar Tablosu
CREATE TABLE IF NOT EXISTS rooms (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  code TEXT UNIQUE NOT NULL, -- Odaya katılmak için kısa kod (Örn: "A1B2")
  host_id UUID REFERENCES users(id) NOT NULL,
  status TEXT NOT NULL DEFAULT 'waiting' CHECK (status IN ('waiting', 'playing', 'finished')),
  config JSONB DEFAULT '{"wordCount": 5, "wordLength": 5, "isPublic": false}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  ended_at TIMESTAMP WITH TIME ZONE
);

-- 2. Oda Katılımcıları
CREATE TABLE IF NOT EXISTS room_participants (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  room_id UUID REFERENCES rooms(id) ON DELETE CASCADE,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'ready' CHECK (status IN ('ready', 'playing', 'finished', 'spectating')),
  current_word_index INTEGER DEFAULT 0, -- Kaçıncı kelimede?
  words_completed INTEGER DEFAULT 0, -- Kaç kelime tamamladı?
  score INTEGER DEFAULT 0,
  joined_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  finished_at TIMESTAMP WITH TIME ZONE,
  UNIQUE(room_id, user_id)
);

-- 3. Oda Oyun Verisi (Soru Seti)
CREATE TABLE IF NOT EXISTS room_games (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  room_id UUID REFERENCES rooms(id) ON DELETE CASCADE,
  words JSONB NOT NULL, -- Seçilen kelimeler: ["MASA", "KALEM", ...]
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Realtime için Yayınlama
ALTER PUBLICATION supabase_realtime ADD TABLE rooms;
ALTER PUBLICATION supabase_realtime ADD TABLE room_participants;
ALTER PUBLICATION supabase_realtime ADD TABLE room_games;

-- RLS Politikaları
ALTER TABLE rooms ENABLE ROW LEVEL SECURITY;
ALTER TABLE room_participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE room_games ENABLE ROW LEVEL SECURITY;

-- Herkes odaları görebilir (veya sadece katılımcılar)
CREATE POLICY "Public rooms are viewable" ON rooms FOR SELECT 
  USING (true); 

CREATE POLICY "Users can create rooms" ON rooms FOR INSERT 
  WITH CHECK (auth.uid() = host_id);

CREATE POLICY "Host can update room" ON rooms FOR UPDATE 
  USING (auth.uid() = host_id);
  
-- Katılımcılar
CREATE POLICY "Participants viewable by everyone in room" ON room_participants FOR SELECT 
  USING (true);

CREATE POLICY "Users can join rooms" ON room_participants FOR INSERT 
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own status" ON room_participants FOR UPDATE 
  USING (auth.uid() = user_id);

-- Oyun Verisi
CREATE POLICY "Room participants can view game words" ON room_games FOR SELECT 
  USING (EXISTS (
    SELECT 1 FROM room_participants 
    WHERE room_participants.room_id = room_games.room_id 
    AND room_participants.user_id = auth.uid()
  ));

-- Fonksiyon: Oda Kodu Oluşturma
CREATE OR REPLACE FUNCTION generate_room_code()
RETURNS TEXT AS $$
DECLARE
  chars TEXT := 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  result TEXT := '';
  i INTEGER := 0;
BEGIN
  FOR i IN 1..6 LOOP
    result := result || substr(chars, floor(random() * length(chars) + 1)::integer, 1);
  END LOOP;
  RETURN result;
END;
$$ LANGUAGE plpgsql;

-- Trigger: Oda oluşurken otomatik kod ata
CREATE OR REPLACE FUNCTION set_room_code()
RETURNS TRIGGER AS $$
BEGIN
  NEW.code := generate_room_code();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_set_room_code
BEFORE INSERT ON rooms
FOR EACH ROW
WHEN (NEW.code IS NULL)
EXECUTE FUNCTION set_room_code();

-- Fonksiyon: Oyunu Başlat (Kelimeleri seç ve durumu güncelle)
CREATE OR REPLACE FUNCTION start_room_game(p_room_id UUID, p_word_count INTEGER, p_word_length INTEGER)
RETURNS VOID AS $$
DECLARE
  v_words JSONB;
BEGIN
  -- 1. Kelimeleri seç
  SELECT jsonb_agg(word) INTO v_words
  FROM (
    SELECT word FROM game_words
    WHERE length = p_word_length
    ORDER BY random()
    LIMIT p_word_count
  ) t;

  -- 2. room_games tablosuna ekle
  INSERT INTO room_games (room_id, words) VALUES (p_room_id, v_words);

  -- 3. Oda durumunu playing yap
  UPDATE rooms SET status = 'playing' WHERE id = p_room_id;
  
  -- 4. Katılımcıların durumunu güncelle
  UPDATE room_participants SET status = 'playing' WHERE room_id = p_room_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Fonksiyon: Eski Odaları Temizle
CREATE OR REPLACE FUNCTION cleanup_stale_rooms()
RETURNS VOID AS $$
BEGIN
  -- 24 saatten eski odaları sil
  DELETE FROM rooms 
  WHERE created_at < NOW() - INTERVAL '24 hours';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
