-- Game moves'a round bilgisi ekle
ALTER TABLE game_moves 
ADD COLUMN IF NOT EXISTS round_number INTEGER NOT NULL DEFAULT 1;

-- Index ekle
CREATE INDEX IF NOT EXISTS idx_game_moves_round ON game_moves(game_id, round_number);
