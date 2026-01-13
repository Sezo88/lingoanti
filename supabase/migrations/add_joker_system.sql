-- Joker & Bilet Sistemi Migration
-- Kullanıcı para birimi, joker kullanımı ve reklam ödülleri

-- 1. User Currency Tablosu (Bilet ve Kalp)
CREATE TABLE IF NOT EXISTS user_currency (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  tickets INT DEFAULT 100 CHECK (tickets >= 0),           -- 🎫 Bilet
  hearts INT DEFAULT 5 CHECK (hearts >= 0 AND hearts <= 5), -- ❤️ Kalp (max 5)
  last_heart_regen TIMESTAMPTZ DEFAULT NOW(),              -- Son kalp yenilenme zamanı
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for faster lookups
CREATE INDEX IF NOT EXISTS idx_user_currency_user_id ON user_currency(user_id);

-- 2. Joker Usage Tablosu (Kullanım geçmişi)
CREATE TABLE IF NOT EXISTS joker_usage (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  game_id UUID REFERENCES games(id) ON DELETE SET NULL,
  joker_type TEXT NOT NULL CHECK (joker_type IN ('green_letter', 'yellow_letter', 'extra_attempt', 'reveal_word')),
  cost INT NOT NULL CHECK (cost > 0),                      -- Harcanan bilet
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_joker_usage_user_id ON joker_usage(user_id);
CREATE INDEX IF NOT EXISTS idx_joker_usage_created_at ON joker_usage(created_at);

-- 3. Ad Rewards Tablosu (Reklam ödül geçmişi)
CREATE TABLE IF NOT EXISTS ad_rewards (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  reward_type TEXT NOT NULL CHECK (reward_type IN ('tickets', 'hearts')),
  amount INT NOT NULL CHECK (amount > 0),
  ad_type TEXT CHECK (ad_type IN ('rewarded', 'interstitial')),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_ad_rewards_user_id ON ad_rewards(user_id);
CREATE INDEX IF NOT EXISTS idx_ad_rewards_created_at ON ad_rewards(created_at);

-- 4. RPC: Bilet Harca
CREATE OR REPLACE FUNCTION spend_tickets(
  p_user_id UUID,
  p_amount INT,
  p_joker_type TEXT,
  p_game_id UUID DEFAULT NULL
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_current_tickets INT;
BEGIN
  -- Mevcut bilet sayısını al
  SELECT tickets INTO v_current_tickets
  FROM user_currency
  WHERE user_id = p_user_id;

  -- Yeterli bilet var mı?
  IF v_current_tickets IS NULL OR v_current_tickets < p_amount THEN
    RETURN FALSE;
  END IF;

  -- Bilet harca
  UPDATE user_currency
  SET tickets = tickets - p_amount,
      updated_at = NOW()
  WHERE user_id = p_user_id;

  -- Kullanım kaydı oluştur
  INSERT INTO joker_usage (user_id, game_id, joker_type, cost)
  VALUES (p_user_id, p_game_id, p_joker_type, p_amount);

  RETURN TRUE;
END;
$$;

-- 5. RPC: Kalp Harca
CREATE OR REPLACE FUNCTION spend_heart(p_user_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_current_hearts INT;
BEGIN
  -- Mevcut kalp sayısını al
  SELECT hearts INTO v_current_hearts
  FROM user_currency
  WHERE user_id = p_user_id;

  -- Yeterli kalp var mı?
  IF v_current_hearts IS NULL OR v_current_hearts < 1 THEN
    RETURN FALSE;
  END IF;

  -- Kalp harca
  UPDATE user_currency
  SET hearts = hearts - 1,
      updated_at = NOW()
  WHERE user_id = p_user_id;

  RETURN TRUE;
END;
$$;

-- 6. RPC: Kalp Yenile (30 dakikada 1)
CREATE OR REPLACE FUNCTION regenerate_hearts(p_user_id UUID)
RETURNS INT
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_current_hearts INT;
  v_last_regen TIMESTAMPTZ;
  v_hearts_to_add INT;
  v_new_hearts INT;
BEGIN
  -- Mevcut durumu al
  SELECT hearts, last_heart_regen
  INTO v_current_hearts, v_last_regen
  FROM user_currency
  WHERE user_id = p_user_id;

  -- Kullanıcı yoksa veya zaten max kalp varsa
  IF v_current_hearts IS NULL OR v_current_hearts >= 5 THEN
    RETURN COALESCE(v_current_hearts, 0);
  END IF;

  -- 30 dakika geçmiş mi kontrol et
  v_hearts_to_add := FLOOR(EXTRACT(EPOCH FROM (NOW() - v_last_regen)) / 1800)::INT;

  IF v_hearts_to_add > 0 THEN
    -- Yeni kalp sayısını hesapla (max 5)
    v_new_hearts := LEAST(v_current_hearts + v_hearts_to_add, 5);

    -- Güncelle
    UPDATE user_currency
    SET hearts = v_new_hearts,
        last_heart_regen = NOW(),
        updated_at = NOW()
    WHERE user_id = p_user_id;

    RETURN v_new_hearts;
  END IF;

  RETURN v_current_hearts;
END;
$$;

-- 7. RPC: Reklam Ödülü Ver
CREATE OR REPLACE FUNCTION reward_ad(
  p_user_id UUID,
  p_reward_type TEXT,
  p_amount INT
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Ödül tipine göre güncelle
  IF p_reward_type = 'tickets' THEN
    UPDATE user_currency
    SET tickets = tickets + p_amount,
        updated_at = NOW()
    WHERE user_id = p_user_id;
  ELSIF p_reward_type = 'hearts' THEN
    UPDATE user_currency
    SET hearts = LEAST(hearts + p_amount, 5), -- Max 5 kalp
        last_heart_regen = NOW(),
        updated_at = NOW()
    WHERE user_id = p_user_id;
  ELSE
    RETURN FALSE;
  END IF;

  -- Ödül kaydı oluştur
  INSERT INTO ad_rewards (user_id, reward_type, amount, ad_type)
  VALUES (p_user_id, p_reward_type, p_amount, 'rewarded');

  RETURN TRUE;
END;
$$;

-- 8. RPC: Bilet Ekle (Satın alma veya bonus)
CREATE OR REPLACE FUNCTION add_tickets(
  p_user_id UUID,
  p_amount INT,
  p_source TEXT DEFAULT 'purchase'
)
RETURNS INT
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_new_total INT;
BEGIN
  -- Bilet ekle
  UPDATE user_currency
  SET tickets = tickets + p_amount,
      updated_at = NOW()
  WHERE user_id = p_user_id
  RETURNING tickets INTO v_new_total;

  RETURN v_new_total;
END;
$$;

-- 9. RPC: Kullanıcı Currency'sini Al veya Oluştur
CREATE OR REPLACE FUNCTION get_or_create_user_currency(p_user_id UUID)
RETURNS TABLE (
  tickets INT,
  hearts INT,
  last_heart_regen TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Önce var mı kontrol et
  RETURN QUERY
  SELECT uc.tickets, uc.hearts, uc.last_heart_regen
  FROM user_currency uc
  WHERE uc.user_id = p_user_id;

  -- Yoksa oluştur
  IF NOT FOUND THEN
    INSERT INTO user_currency (user_id, tickets, hearts, last_heart_regen)
    VALUES (p_user_id, 100, 5, NOW())
    ON CONFLICT (user_id) DO NOTHING;

    RETURN QUERY
    SELECT uc.tickets, uc.hearts, uc.last_heart_regen
    FROM user_currency uc
    WHERE uc.user_id = p_user_id;
  END IF;
END;
$$;

-- 10. Trigger: Updated_at otomatik güncelleme
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_user_currency_updated_at
  BEFORE UPDATE ON user_currency
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- 11. RLS (Row Level Security) Policies
ALTER TABLE user_currency ENABLE ROW LEVEL SECURITY;
ALTER TABLE joker_usage ENABLE ROW LEVEL SECURITY;
ALTER TABLE ad_rewards ENABLE ROW LEVEL SECURITY;

-- User currency policies
CREATE POLICY "Users can view own currency"
  ON user_currency FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can update own currency"
  ON user_currency FOR UPDATE
  USING (auth.uid() = user_id);

-- Joker usage policies
CREATE POLICY "Users can view own joker usage"
  ON joker_usage FOR SELECT
  USING (auth.uid() = user_id);

-- Ad rewards policies
CREATE POLICY "Users can view own ad rewards"
  ON ad_rewards FOR SELECT
  USING (auth.uid() = user_id);

-- Grant permissions
GRANT ALL ON user_currency TO authenticated;
GRANT ALL ON joker_usage TO authenticated;
GRANT ALL ON ad_rewards TO authenticated;
