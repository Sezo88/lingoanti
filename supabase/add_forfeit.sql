-- Oyunlara forfeit/surrender bilgisi ekle
ALTER TABLE games 
ADD COLUMN IF NOT EXISTS forfeited_by UUID REFERENCES users(id);
