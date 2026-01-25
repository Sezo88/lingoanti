-- Fix Heart Regeneration & Ad Rewards Logic v2
-- 1. Revert interval to 30 minutes
-- 2. Fix ad rewards resetting timer
-- 3. Fix timer restart logic
-- 4. Enable auto-regen on fetch

-- 1. RPC: Yenileme Fonksiyonu (Düzeltilmiş)
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
  v_interval INT := 1800; -- 30 dakika (saniye)
  v_seconds_passed INT;
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

  v_seconds_passed := EXTRACT(EPOCH FROM (NOW() - v_last_regen))::INT;

  -- 30 dakika geçmiş mi kontrol et
  v_hearts_to_add := FLOOR(v_seconds_passed / v_interval)::INT;

  IF v_hearts_to_add > 0 THEN
    -- Yeni kalp sayısını hesapla (max 5)
    v_new_hearts := LEAST(v_current_hearts + v_hearts_to_add, 5);

    -- Eğer max'a ulaştıysak zamanı sıfırla/guncelle, değilse artan zamanı koru
    -- Örnek: 40 dk geçti (1 kalp ekle, 10 dk cebe at). 
    -- last_regen = last_regen + (1 * 30dk)
    
    IF v_new_hearts >= 5 THEN
       -- Max oldu, artık sayaç önemli değil, ama temiz olsun diye NOW yapabiliriz ya da olduğu gibi bırakırız.
       -- Max olunca timer durmalı, spend_heart tekrar başlatacak.
       UPDATE user_currency
       SET hearts = v_new_hearts,
           last_heart_regen = NOW(), -- Reset for future clean state
           updated_at = NOW()
       WHERE user_id = p_user_id;
    ELSE
       -- Hala 5'ten az, artan süreyi koruyarak update et
       UPDATE user_currency
       SET hearts = v_new_hearts,
           last_heart_regen = v_last_regen + (v_hearts_to_add * interval '30 minutes'),
           updated_at = NOW()
       WHERE user_id = p_user_id;
    END IF;

    RETURN v_new_hearts;
  END IF;

  RETURN v_current_hearts;
END;
$$;

-- 2. RPC: Reklam Ödülü (Düzeltilmiş - Timer Bozmuyor)
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
    -- Kalp ekle ama last_heart_regen SIFIRLAMA (Timer devam etsin)
    -- Sadece kalp 5 olursa timer'ın önemi kalmaz ama yine de ellemiyoruz.
    UPDATE user_currency
    SET hearts = LEAST(hearts + p_amount, 5),
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

-- 3. RPC: Kalp Harca (Düzeltilmiş - Timer Başlatma)
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
  -- Eğer şu an FULL (5 veya daha fazla) ise ve harcayınca altına düşeceksek -> Timer BAŞLAT
  IF v_current_hearts >= 5 THEN
      UPDATE user_currency
      SET hearts = hearts - 1,
          last_heart_regen = NOW(), -- Timer şimdi başlasın
          updated_at = NOW()
      WHERE user_id = p_user_id;
  ELSE
      -- Zaten 5'ten azdı, timer çalışıyor olmalı, DOKUNMA
      UPDATE user_currency
      SET hearts = hearts - 1,
          updated_at = NOW()
      WHERE user_id = p_user_id;
  END IF;

  RETURN TRUE;
END;
$$;

-- 4. RPC: Get Currency (Auto-Regen ekli)
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
  -- 1. Önce regenaration çalıştır
  PERFORM regenerate_hearts(p_user_id);

  -- 2. Mevcut durumu döndür
  RETURN QUERY
  SELECT uc.tickets, uc.hearts, uc.last_heart_regen
  FROM user_currency uc
  WHERE uc.user_id = p_user_id;

  -- 3. Yoksa oluştur
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
