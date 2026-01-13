-- Migration: Add RPC for Turn-Based Guess Submission
-- This fixes RLS issues by handling updates on server side with SECURITY DEFINER

CREATE OR REPLACE FUNCTION submit_turn_guess(
  p_room_id UUID,
  p_user_id UUID,
  p_guess TEXT,
  p_result JSONB,
  p_is_correct BOOLEAN
)
RETURNS VOID AS $$
DECLARE
  v_room rooms%ROWTYPE;
  v_game_state JSONB;
  v_config JSONB;
  v_turn_order UUID[];
  v_current_turn INT;
  v_current_player UUID;
  v_base_score INT := 100;
  v_word_score INT;
BEGIN
  -- 1. Odayı kilitle ve al
  SELECT * INTO v_room FROM rooms WHERE id = p_room_id FOR UPDATE;
  
  v_config := v_room.config;
  v_game_state := COALESCE(v_room.game_state, '{"guesses": [], "results": [], "currentWordIndex": 0}'::jsonb);
  v_turn_order := ARRAY(SELECT jsonb_array_elements_text(v_config->'turnOrder')::UUID);
  v_current_turn := (v_config->>'currentTurn')::INT;
  
  -- 2. Sıra kontrolü
  IF array_length(v_turn_order, 1) > 0 THEN
      v_current_player := v_turn_order[(v_current_turn % array_length(v_turn_order, 1)) + 1];
      IF v_current_player != p_user_id THEN
        RAISE EXCEPTION 'Not your turn';
      END IF;
  END IF;

  -- 3. Game State güncelle (Tahmini ekle)
  -- jsonb_insert veya || operatörü ile ekle
  UPDATE rooms 
  SET game_state = jsonb_set(
    jsonb_set(
        v_game_state, 
        '{guesses}', 
        (v_game_state->'guesses') || to_jsonb(p_guess)
    ),
    '{results}',
    (v_game_state->'results') || p_result
  )
  WHERE id = p_room_id;

  -- 4. Puan ve Tur Yönetimi
  IF p_is_correct THEN
    -- Doğru bilindi: Puanı ver, yeni kelimeye geç
    -- Puan hesapla (Mevcut tahmin sayısı üzerinden)
    v_word_score := v_base_score + GREATEST(0, (6 - (jsonb_array_length(v_game_state->'guesses') + 1)) * 10);
    
    -- Puanı katılımcıya ekle
    UPDATE room_participants
    SET score = COALESCE(score, 0) + v_word_score
    WHERE room_id = p_room_id AND user_id = p_user_id;

    -- Yeni kelimeye geç (Sıra değişir, game_state sıfırlanır)
    UPDATE rooms
    SET 
      game_state = jsonb_build_object(
        'guesses', '[]'::jsonb,
        'results', '[]'::jsonb,
        'currentWordIndex', (v_game_state->>'currentWordIndex')::INT + 1
      ),
      config = jsonb_set(
        jsonb_set(
            jsonb_set(
                v_config,
                '{currentTurn}',
                to_jsonb(v_current_turn + 1)
            ),
            '{currentRound}',
            to_jsonb(((v_game_state->>'currentWordIndex')::INT + 1))
        ),
        '{turnStartTime}',
        to_jsonb((EXTRACT(EPOCH FROM NOW()) * 1000)::BIGINT)
      )
    WHERE id = p_room_id;
    
  ELSE
    -- Yanlış bilindi: Sadece sırayı ilerlet ve turnStartTime güncelle
    UPDATE rooms
    SET config = jsonb_set(
        jsonb_set(
            v_config,
            '{currentTurn}',
            to_jsonb(v_current_turn + 1)
        ),
        '{turnStartTime}',
        to_jsonb((EXTRACT(EPOCH FROM NOW()) * 1000)::BIGINT)
    )
    WHERE id = p_room_id;
    
    -- Eğer 6 tahmin dolmuşsa, yeni kelimeye geç
    IF jsonb_array_length(v_game_state->'guesses') + 1 >= 6 THEN
      UPDATE rooms
      SET 
        game_state = jsonb_build_object(
          'guesses', '[]'::jsonb,
          'results', '[]'::jsonb,
          'currentWordIndex', (v_game_state->>'currentWordIndex')::INT + 1
        ),
        config = jsonb_set(
          jsonb_set(
              v_config,
              '{currentTurn}',
              to_jsonb(v_current_turn + 1)
          ),
          '{turnStartTime}',
          to_jsonb((EXTRACT(EPOCH FROM NOW()) * 1000)::BIGINT)
        )
      WHERE id = p_room_id;
    END IF;
  END IF;

END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
