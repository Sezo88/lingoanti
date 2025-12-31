-- 1. Tüm kelimeleri küçük harfe çevir (Türkçe karakterler için)
UPDATE words 
SET word = LOWER(word);

-- 2. Duplicate'leri bul ve sil (en eski kaydı tut)
DELETE FROM words a
USING words b
WHERE a.id > b.id 
AND a.word = b.word 
AND a.length = b.length;

-- 3. Unique constraint ekle (duplicate engelle)
CREATE UNIQUE INDEX IF NOT EXISTS idx_words_unique ON words(word, length);

-- 4. Kontrol et
SELECT word, COUNT(*) as count 
FROM words 
GROUP BY word 
HAVING COUNT(*) > 1;
