-- Oyunlara mixed_mode alanı ekle
ALTER TABLE games 
ADD COLUMN IF NOT EXISTS mixed_mode BOOLEAN NOT NULL DEFAULT false;
