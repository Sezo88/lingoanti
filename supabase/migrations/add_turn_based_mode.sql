-- Migration: Add Turn-Based Game Mode Support + Shared Game State
-- Run this in Supabase SQL Editor

-- 1. Add game_mode column to rooms table
ALTER TABLE rooms 
ADD COLUMN IF NOT EXISTS game_mode TEXT NOT NULL DEFAULT 'arena' 
CHECK (game_mode IN ('arena', 'turn_based'));

-- 2. Add game_words column to rooms table
ALTER TABLE rooms 
ADD COLUMN IF NOT EXISTS game_words TEXT[];

-- 3. Add game_state column for shared turn-based state
ALTER TABLE rooms 
ADD COLUMN IF NOT EXISTS game_state JSONB DEFAULT '{
  "guesses": [],
  "results": [],
  "currentWordIndex": 0
}'::jsonb;

-- 4. Update rooms config structure to support turn-based
UPDATE rooms 
SET config = jsonb_set(
    jsonb_set(
        jsonb_set(
            jsonb_set(
                COALESCE(config, '{}'::jsonb),
                '{turnOrder}', '[]'::jsonb, true
            ),
            '{currentTurn}', '0'::jsonb, true
        ),
        '{roundsTotal}', '0'::jsonb, true
    ),
    '{currentRound}', '0'::jsonb, true
);

-- 5. Add turn_score column to room_participants
ALTER TABLE room_participants 
ADD COLUMN IF NOT EXISTS turn_score INTEGER DEFAULT 0;

-- 6. Update start_room_game function to initialize turn order
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
  SELECT ARRAY(
    SELECT word FROM words 
    WHERE length = p_word_length 
    ORDER BY RANDOM() 
    LIMIT p_word_count
  ) INTO v_words;

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
          COALESCE(config, '{}'::jsonb),
          '{turnOrder}', 
          to_jsonb(v_participant_ids), 
          true
        ),
        '{currentTurn}', '0'::jsonb, true
      ),
      '{roundsTotal}', to_jsonb(v_rounds_total), true
    )
    WHERE id = p_room_id;
  END IF;

  -- Katılımcıları 'playing' yap
  UPDATE room_participants 
  SET status = 'playing' 
  WHERE room_id = p_room_id;
END;
$$ LANGUAGE plpgsql;
