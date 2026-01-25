-- Eski oyunların finished_at değerini güncelle
-- Bu script sadece bir kere çalıştırılmalı

-- finished_at NULL olan ama status='finished' olan oyunları güncelle
UPDATE games 
SET finished_at = created_at 
WHERE status = 'finished' 
  AND finished_at IS NULL;

-- Kaç kayıt güncellendi kontrol et
SELECT COUNT(*) as updated_count
FROM games 
WHERE status = 'finished' 
  AND finished_at IS NOT NULL;
