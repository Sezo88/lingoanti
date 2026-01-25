-- 1. turn_started_at varsayılan değerini NULL yap (böylece oyun başlayınca hemen süre akmaz)
ALTER TABLE games ALTER COLUMN turn_started_at DROP DEFAULT;
ALTER TABLE games ALTER COLUMN turn_started_at SET DEFAULT NULL;

-- 2. Timer'ı başlatma fonksiyonu
CREATE OR REPLACE FUNCTION start_turn_timer(p_game_id UUID)
RETURNS VOID AS $$
BEGIN
    UPDATE games
    SET turn_started_at = NOW()
    WHERE id = p_game_id
      AND turn_started_at IS NULL; -- Sadece başlamamışsa başlat
END;
$$ LANGUAGE plpgsql;

-- Not: Mevcut oyunları etkilemez, yeni oyunlarda süre NULL başlar.
