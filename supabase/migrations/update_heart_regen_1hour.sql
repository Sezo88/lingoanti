-- Update heart regeneration to 1 hour (3600 seconds) instead of 30 minutes

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

  -- 1 saat (3600 saniye) geçmiş mi kontrol et
  v_hearts_to_add := FLOOR(EXTRACT(EPOCH FROM (NOW() - v_last_regen)) / 3600)::INT;

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
