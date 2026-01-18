-- Fix start_room_game to handle p_word_length = 0 (Mixed Mode)

CREATE OR REPLACE FUNCTION start_room_game(
  p_room_id UUID,
  p_word_count INT DEFAULT 5,
  p_word_length INT DEFAULT 5
)
RETURNS VOID AS $$
DECLARE
  v_words TEXT[];
  v_game_mode TEXT;
  v_participant_ids UUID[];
  v_rounds_total INT;
BEGIN
  -- Get room's game mode
  SELECT game_mode INTO v_game_mode FROM rooms WHERE id = p_room_id;

  -- Rastgele kelimeler seç
  -- FIX: p_word_length = 0 ise uzunluk kısıtlaması yapma (Karışık/Mixed)
  SELECT ARRAY(
    SELECT word FROM words 
    WHERE (p_word_length = 0 OR length = p_word_length)
    ORDER BY RANDOM() 
    LIMIT p_word_count
  ) INTO v_words;

  -- Eğer hiç kelime bulunamazsa (örn: veritabanı boşsa), boş dizi yerine hata veya default dönmeyelim, 
  -- ama boş dizi dönerse frontend onu handle etmeli. Şimdilik boş dizi olabilir.

  -- Oyunu başlat
  UPDATE rooms 
  SET status = 'playing', 
      game_words = v_words,
      game_state = '{
        "guesses": [],
        "results": [],
        "currentWordIndex": 0
      }'::jsonb
  WHERE id = p_room_id;

  -- Turn-based mode için ek ayarlar
  IF v_game_mode = 'turn_based' THEN
    -- Katılımcı ID'lerini al
    SELECT ARRAY_AGG(user_id ORDER BY joined_at) INTO v_participant_ids
    FROM room_participants
    WHERE room_id = p_room_id;

    -- El sayısını hesapla (kelime sayısı)
    v_rounds_total := p_word_count;

    -- Config'i güncelle
    UPDATE rooms
    SET config = jsonb_set(
      jsonb_set(
        jsonb_set(
          jsonb_set(
            COALESCE(config, '{}'::jsonb),
            '{turnOrder}', 
            to_jsonb(v_participant_ids), 
            true
          ),
          '{currentTurn}', '0'::jsonb, true
        ),
        '{roundsTotal}', to_jsonb(v_rounds_total), true
      ),
      '{turnStartTime}', to_jsonb((EXTRACT(EPOCH FROM NOW()) * 1000)::BIGINT), true
    )
    WHERE id = p_room_id;
  END IF;

  -- Katılımcıları 'playing' yap
  UPDATE room_participants 
  SET status = 'playing' 
  WHERE room_id = p_room_id;
END;
$$ LANGUAGE plpgsql;
