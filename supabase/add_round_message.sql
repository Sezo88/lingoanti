-- Games tablosuna round_message alanı ekle
ALTER TABLE games 
ADD COLUMN IF NOT EXISTS round_message TEXT;
