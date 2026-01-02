-- 1. Users tablosuna skor kolonlarını ekle
ALTER TABLE users 
ADD COLUMN IF NOT EXISTS score INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS wins INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS losses INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS total_games INTEGER DEFAULT 0;

-- Index for leaderboard performance
CREATE INDEX IF NOT EXISTS idx_users_score ON users(score DESC);

-- 2. Oyun bittiğinde puanları güncelleyen Trigger Fonksiyonu
CREATE OR REPLACE FUNCTION handle_game_end()
RETURNS TRIGGER AS $$
BEGIN
  -- Sadece oyun durumu 'finished' olduğunda ve kazanan varsa çalış
  IF NEW.status = 'finished' AND NEW.winner_id IS NOT NULL THEN
    
    -- Kazananın puanını artır (+20 puan)
    UPDATE users 
    SET 
      score = score + 20,
      wins = wins + 1,
      total_games = total_games + 1
    WHERE id = NEW.winner_id;

    -- Kaybedenin puanını azalt (-10 puan, minimum 0)
    -- Kaybeden, oyunun oyuncularından (p1 veya p2) kazanan olmayan kişidir.
    UPDATE users 
    SET 
      score = GREATEST(0, score - 10),
      losses = losses + 1,
      total_games = total_games + 1
    WHERE id IN (NEW.player1_id, NEW.player2_id) AND id != NEW.winner_id;
    
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. Trigger Oluştur
DROP TRIGGER IF EXISTS on_game_finish ON games;

CREATE TRIGGER on_game_finish
AFTER UPDATE ON games
FOR EACH ROW
WHEN (OLD.status IS DISTINCT FROM 'finished' AND NEW.status = 'finished')
EXECUTE FUNCTION handle_game_end();
