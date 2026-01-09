-- Multiplayer Modu için Veritabanı Şeması

-- 1. Odalar Tablosu
CREATE TABLE IF NOT EXISTS rooms (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  code TEXT UNIQUE NOT NULL DEFAULT generate_room_code(),
  host_id UUID REFERENCES users(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'waiting' CHECK (status IN ('waiting', 'playing', 'finished')),
  game_mode TEXT NOT NULL DEFAULT 'arena' CHECK (game_mode IN ('arena', 'turn_based')),
  config JSONB DEFAULT '{
    "isPublic": false,
    "wordCount": 5,
    "wordLength": 5,
    "duration": 60,
    "turnOrder": [],
    "currentTurn": 0,
    "roundsTotal": 0,
    "currentRound": 0
  }'::jsonb,
  game_words TEXT[],
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
  turn_score INTEGER DEFAULT 0, -- Turn-based modda her elde kazanılan puan
  word_times JSONB DEFAULT '[]'::jsonb, -- [{"wordIndex": 0, "timeSeconds": 45, "score": 150}, ...]
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
CREATE OR REPLACE FUNCTION start_room_game(
  p_room_id UUID,
  p_word_count INT DEFAULT 5,
  p_word_length INT DEFAULT 5
)
RETURNS VOID AS $$
DECLARE
  v_words TEXT[];
  v_game_mode TEXT;
  v_participant_ids UUID[];
  v_rounds_total INT;
BEGIN
  -- Get room's game mode
  SELECT game_mode INTO v_game_mode FROM rooms WHERE id = p_room_id;

  -- Rastgele kelimeler seç
  SELECT ARRAY(
    SELECT word FROM game_words 
    WHERE length = p_word_length 
    ORDER BY RANDOM() 
    LIMIT p_word_count
  ) INTO v_words;

  -- Oyunu başlat
  UPDATE rooms 
  SET status = 'playing', 
      game_words = v_words
  WHERE id = p_room_id;

  -- Turn-based mode için ek ayarlar
  IF v_game_mode = 'turn_based' THEN
    -- Katılımcı ID'lerini al
    SELECT ARRAY_AGG(user_id ORDER BY joined_at) INTO v_participant_ids
    FROM room_participants
    WHERE room_id = p_room_id;

    -- El sayısını hesapla (katılımcı sayısı × 2)
    v_rounds_total := ARRAY_LENGTH(v_participant_ids, 1) * 2;

    -- Config'i güncelle
    UPDATE rooms
    SET config = jsonb_set(
      jsonb_set(
        jsonb_set(
          COALESCE(config, '{}'::jsonb),
          '{turnOrder}', 
          to_jsonb(v_participant_ids), 
          true
        ),
        '{currentTurn}', '0'::jsonb, true
      ),
      '{roundsTotal}', to_jsonb(v_rounds_total), true
    )
    WHERE id = p_room_id;
  END IF;

  -- Katılımcıları 'playing' yap
  UPDATE room_participants 
  SET status = 'playing' 
  WHERE room_id = p_room_id;
END;
$$ LANGUAGE plpgsql;

-- Fonksiyon: Eski Odaları Temizle
CREATE OR REPLACE FUNCTION cleanup_stale_rooms()
RETURNS VOID AS $$
BEGIN
  -- 24 saatten eski odaları sil
  DELETE FROM rooms 
  WHERE created_at < NOW() - INTERVAL '24 hours';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
