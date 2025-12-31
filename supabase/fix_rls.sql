-- Users RLS Policy Düzeltmesi - BASIT ÇÖZÜM
-- Supabase SQL Editor'da çalıştırın

-- Önce eski policy'yi kaldır
DROP POLICY IF EXISTS "Users can insert own profile" ON users;

-- Yeni, daha esnek policy ekle
-- Kayıt sırasında herkes ekleyebilir (zaten email/password kontrolü var)
CREATE POLICY "Allow user registration" ON users 
  FOR INSERT 
  WITH CHECK (true);

-- Veya sadece authenticated kullanıcılar ekleyebilir
-- CREATE POLICY "Allow user registration" ON users 
--   FOR INSERT 
--   WITH CHECK (auth.role() = 'authenticated' OR auth.role() = 'anon');
