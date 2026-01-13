-- 1. game_words tablosuna durum sütunu ekle
ALTER TABLE game_words ADD COLUMN IF NOT EXISTS filter_status TEXT DEFAULT 'pending';

-- 2. Sorgu performansını artırmak için index ekle
CREATE INDEX IF NOT EXISTS idx_game_words_filter_status ON game_words(filter_status);

-- 3. RLS Politikalarını güncelle (Update yetkisi ver)
CREATE POLICY "Allow update game_words" ON game_words FOR UPDATE USING (true) WITH CHECK (true);

-- Not: Artık kelimeleri 'pending', 'approved' veya 'rejected' olarak işaretleyebiliriz.
