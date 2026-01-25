-- Profil Sistemi SQL

-- 1. Users tablosuna yeni kolonlar ekle
ALTER TABLE users 
ADD COLUMN IF NOT EXISTS avatar_id INTEGER DEFAULT 1,
ADD COLUMN IF NOT EXISTS privacy_settings JSONB DEFAULT '{"show_email": false, "show_stats": true}'::jsonb;

-- 2. Kullanıcı profil bilgilerini getiren fonksiyon
CREATE OR REPLACE FUNCTION get_user_profile(target_user_id UUID, requesting_user_id UUID DEFAULT NULL)
RETURNS TABLE (
  user_id UUID,
  username TEXT,
  display_name TEXT,
  avatar_id INTEGER,
  email TEXT,
  created_at TIMESTAMPTZ,
  total_score INTEGER,
  total_wins INTEGER,
  total_losses INTEGER,
  total_games INTEGER,
  win_rate NUMERIC,
  longest_win_streak INTEGER,
  privacy_settings JSONB,
  is_own_profile BOOLEAN
) AS $$
DECLARE
  privacy JSONB;
  is_own BOOLEAN;
BEGIN
  -- Kendi profili mi kontrol et
  is_own := (target_user_id = requesting_user_id);
  
  -- Privacy settings'i al
  SELECT u.privacy_settings INTO privacy
  FROM users u
  WHERE u.id = target_user_id;
  
  RETURN QUERY
  SELECT 
    u.id as user_id,
    u.username,
    u.display_name,
    u.avatar_id,
    -- Email sadece kendi profilinde veya public ise göster
    CASE 
      WHEN is_own OR (privacy->>'show_email')::boolean = true THEN u.email
      ELSE NULL
    END as email,
    u.created_at,
    -- İstatistikler sadece kendi profilinde veya public ise göster
    CASE 
      WHEN is_own OR (privacy->>'show_stats')::boolean = true THEN u.score
      ELSE NULL
    END as total_score,
    CASE 
      WHEN is_own OR (privacy->>'show_stats')::boolean = true THEN u.wins
      ELSE NULL
    END as total_wins,
    CASE 
      WHEN is_own OR (privacy->>'show_stats')::boolean = true THEN u.losses
      ELSE NULL
    END as total_losses,
    CASE 
      WHEN is_own OR (privacy->>'show_stats')::boolean = true THEN u.total_games
      ELSE NULL
    END as total_games,
    -- Kazanma yüzdesi
    CASE 
      WHEN is_own OR (privacy->>'show_stats')::boolean = true THEN
        CASE 
          WHEN u.total_games > 0 THEN ROUND((u.wins::numeric / u.total_games::numeric) * 100, 1)
          ELSE 0
        END
      ELSE NULL
    END as win_rate,
    -- En uzun galibiyet serisi (şimdilik 0, ileride hesaplanabilir)
    CASE 
      WHEN is_own OR (privacy->>'show_stats')::boolean = true THEN 0
      ELSE NULL
    END as longest_win_streak,
    u.privacy_settings,
    is_own as is_own_profile
  FROM users u
  WHERE u.id = target_user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. Profil güncelleme fonksiyonu
CREATE OR REPLACE FUNCTION update_user_profile(
  user_id UUID,
  new_display_name TEXT DEFAULT NULL,
  new_avatar_id INTEGER DEFAULT NULL,
  new_privacy_settings JSONB DEFAULT NULL
)
RETURNS BOOLEAN AS $$
BEGIN
  UPDATE users
  SET 
    display_name = COALESCE(new_display_name, display_name),
    avatar_id = COALESCE(new_avatar_id, avatar_id),
    privacy_settings = COALESCE(new_privacy_settings, privacy_settings)
  WHERE id = user_id;
  
  RETURN FOUND;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

