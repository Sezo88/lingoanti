-- Test: 100000 bilet ekle
-- Supabase SQL Editor'da çalıştır

-- Kendi user_id'ni buraya yaz
UPDATE user_currency 
SET tickets = 100000 
WHERE user_id = 'YOUR_USER_ID_HERE';

-- VEYA tüm kullanıcılara ver (test için)
UPDATE user_currency 
SET tickets = 100000;

-- Eğer user_currency kaydın yoksa önce oluştur:
INSERT INTO user_currency (user_id, tickets, hearts)
VALUES ('YOUR_USER_ID_HERE', 100000, 5)
ON CONFLICT (user_id) 
DO UPDATE SET tickets = 100000;
