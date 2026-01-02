-- 1. Yeni game_words tablosunu oluştur (Mevcut words tablosunun yapısında)
CREATE TABLE IF NOT EXISTS game_words (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  word TEXT NOT NULL,
  length INTEGER NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. Indexleri oluştur
CREATE INDEX IF NOT EXISTS idx_game_words_length ON game_words(length);
CREATE INDEX IF NOT EXISTS idx_game_words_word ON game_words(word);
CREATE UNIQUE INDEX IF NOT EXISTS idx_game_words_unique ON game_words(word, length);

-- 3. RLS Politikalarını ekle (words tablosu ile aynı)
ALTER TABLE game_words ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view game_words" ON game_words FOR SELECT USING (true);
CREATE POLICY "Allow insert game_words" ON game_words FOR INSERT WITH CHECK (true);

-- 4. Mevcut verileri kopyala (words -> game_words)
-- "sorulacak soru tablosu şuan yüklü olan olsun" isteği üzerine
INSERT INTO game_words (word, length)
SELECT word, length FROM words
ON CONFLICT (word, length) DO NOTHING;

-- 5. words tablosunu temizle (Geniş liste için yer aç)
-- "kontrol için daha fazla kelimeli bir liste atacağım" isteği üzerine
TRUNCATE TABLE words;

-- Not: words tablosu artık "Geniş Sözlük" olarak kullanılacak.
