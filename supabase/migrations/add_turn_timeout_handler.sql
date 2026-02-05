-- Migration: Add Turn Timeout Handler
-- This function handles when a player's turn times out in turn-based mode

CREATE OR REPLACE FUNCTION handle_turn_timeout(
  p_room_id UUID,
  p_user_id UUID
)
RETURNS VOID AS $$
DECLARE
  v_room rooms%ROWTYPE;
  v_game_state JSONB;
  v_config JSONB;
  v_turn_order UUID[];
  v_current_turn INT;
  v_current_player UUID;

  v_timeout_result JSONB;
  v_word_length INT;

  -- New variables for Smart Skip
  v_turn_order_json JSONB;
  v_max_players INT;
  v_loop_count INT;
  v_next_turn_index INT;
  v_next_player_id UUID;
  v_next_player_status participant_status; -- Assuming enum exists
BEGIN
  -- 1. Odayı kilitle ve al
  SELECT * INTO v_room FROM rooms WHERE id = p_room_id FOR UPDATE;
  
  IF v_room.id IS NULL THEN
    RAISE EXCEPTION 'Room not found';
  END IF;

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

  -- 3. Kelime uzunluğunu al (game_words dizisinden)
  v_word_length := length((v_room.game_words[(v_game_state->>'currentWordIndex')::INT + 1]));
  
  -- 4. Timeout sonucu oluştur (tüm harfler 'absent')
  v_timeout_result := (
    SELECT jsonb_agg(
      jsonb_build_object(
        'letter', '?',
        'status', 'invalid'
      )
    )
    FROM generate_series(1, v_word_length)
  );

  -- 5. Game State güncelle (Timeout tahminini ekle)
  UPDATE rooms 
  SET game_state = jsonb_set(
    jsonb_set(
        v_game_state, 
        '{guesses}', 
        (v_game_state->'guesses') || to_jsonb(repeat('?', v_word_length))
    ),
    '{results}',
    (v_game_state->'results') || jsonb_build_array(v_timeout_result)
  )
  WHERE id = p_room_id;

  -- 6. SMART TURN ADVANCEMENT (Skip inactive players)
  v_turn_order_json := v_room.config->'turnOrder';
  v_max_players := jsonb_array_length(v_turn_order_json);
  
  -- Create a loop variable safely
  v_loop_count := 0;

  LOOP
    v_current_turn := v_current_turn + 1;
    v_loop_count := v_loop_count + 1;

    -- Prevent infinite loop
    IF v_loop_count > v_max_players THEN EXIT; END IF;

    v_next_turn_index := v_current_turn % v_max_players;
    -- Get UUID as text then cast to UUID
    v_next_player_id := (v_turn_order_json->>v_next_turn_index)::UUID;

    SELECT status INTO v_next_player_status 
    FROM room_participants 
    WHERE room_id = p_room_id AND user_id = v_next_player_id;

    -- Found active player?
    IF v_next_player_status IS NULL OR v_next_player_status IN ('active', 'playing', 'ready') THEN
      EXIT; 
    END IF;
  END LOOP;

  -- 7. Sırayı ilerlet ve turnStartTime'ı güncelle
  UPDATE rooms
  SET config = jsonb_set(
      jsonb_set(
          v_config,
          '{currentTurn}',
          to_jsonb(v_current_turn)
      ),
      '{turnStartTime}',
      to_jsonb((EXTRACT(EPOCH FROM NOW()) * 1000)::BIGINT)
  )
  WHERE id = p_room_id;

  -- 7. Eğer 6 tahmin dolmuşsa, yeni kelimeye geç
  IF jsonb_array_length(v_game_state->'guesses') + 1 >= 6 THEN
    UPDATE rooms
    SET 
      game_state = jsonb_build_object(
        'guesses', '[]'::jsonb,
        'results', '[]'::jsonb,
        'currentWordIndex', (v_game_state->>'currentWordIndex')::INT + 1
      ),
      config = jsonb_set(
        v_config,
        '{turnStartTime}',
        to_jsonb((EXTRACT(EPOCH FROM NOW()) * 1000)::BIGINT)
      )
    WHERE id = p_room_id;
  END IF;

END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
