-- Oyunlar tablosuna match series için yeni alanlar ekle
-- Supabase SQL Editor'da çalıştırın

ALTER TABLE games 
ADD COLUMN IF NOT EXISTS best_of INTEGER NOT NULL DEFAULT 1 CHECK (best_of IN (1, 3, 5, 7)),
ADD COLUMN IF NOT EXISTS current_round INTEGER NOT NULL DEFAULT 1,
ADD COLUMN IF NOT EXISTS player1_score INTEGER NOT NULL DEFAULT 0,
ADD COLUMN IF NOT EXISTS player2_score INTEGER NOT NULL DEFAULT 0;
