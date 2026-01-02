-- Extension kontrolü
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. Eşleşme Kuyruğu Tablosu
CREATE TABLE IF NOT EXISTS matchmaking_queue (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES users(id) NOT NULL UNIQUE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- RLS Politikaları
ALTER TABLE matchmaking_queue ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can insert themselves" ON matchmaking_queue;
CREATE POLICY "Users can insert themselves" ON matchmaking_queue
  FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete themselves" ON matchmaking_queue;
CREATE POLICY "Users can delete themselves" ON matchmaking_queue
  FOR DELETE USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can view queue" ON matchmaking_queue;
CREATE POLICY "Users can view queue" ON matchmaking_queue
  FOR SELECT USING (true); -- Bekleyen sayısını görmek için

-- 2. Eşleşme Fonksiyonu (Atomic)
CREATE OR REPLACE FUNCTION find_match(p_user_id UUID)
RETURNS UUID AS $$
DECLARE
  v_opponent_id UUID;
  v_game_id UUID;
  v_word TEXT;
  v_word_length INT;
BEGIN
  -- 1. Kendisi zaten kuyrukta mı? Eğer varsa işlem yapma veya bekle.
  -- Amaç: Fonksiyonu çağıran kişi kuyruğa girmeden önce rakip arar.
  
  -- Kuyruktaki en eski rakibi bul (Kendisi hariç)
  -- FOR UPDATE SKIP LOCKED: Eşzamanlı işlemlerde aynı kişiyi iki kişi kapmasın diye kilitler.
  SELECT user_id INTO v_opponent_id
  FROM matchmaking_queue
  WHERE user_id != p_user_id
  ORDER BY created_at ASC
  LIMIT 1
  FOR UPDATE SKIP LOCKED;

  -- 2. Rakip bulundu mu?
  IF v_opponent_id IS NOT NULL THEN
    -- A. Rastgele bir kelime seç (game_words tablosundan)
    -- Kelime uzunluğu varsayılan 5 olsun veya rastgele 5-7 arası seçilebilir.
    -- Şimdilik 5 harfli zorlayalım veya rastgele yapalım.
    v_word_length := 5; 
    SELECT word INTO v_word FROM game_words WHERE length = v_word_length ORDER BY RANDOM() LIMIT 1;
    
    -- Eğer kelime bulunamazsa (tablo boşsa), manuel bir kelime ata (fallback)
    IF v_word IS NULL THEN
        v_word := 'KALEM';
    END IF;

    -- B. Oyunu oluştur
    -- B. Oyunu oluştur
    INSERT INTO games (player1_id, player2_id, current_turn, status, word_length, target_word)
    VALUES (v_opponent_id, p_user_id, v_opponent_id, 'active', v_word_length, v_word)
    RETURNING id INTO v_game_id;

    -- C. İki oyuncuyu da kuyruktan sil
    DELETE FROM matchmaking_queue WHERE user_id IN (p_user_id, v_opponent_id);

    RETURN v_game_id;
  
  ELSE
    -- 3. Rakip yoksa, kendisini kuyruğa ekle (Eğer zaten yoksa)
    INSERT INTO matchmaking_queue (user_id)
    VALUES (p_user_id)
    ON CONFLICT (user_id) DO NOTHING;
    
    RETURN NULL; -- Eşleşme olmadı, beklemede
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
