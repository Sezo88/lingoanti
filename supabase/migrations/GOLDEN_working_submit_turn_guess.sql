-- GOLDEN BACKUP: submit_turn_guess
-- Tarih: 17.01.2026
-- Durum: ÇALIŞIYOR (TEST EDİLDİ)

-- ÖZELLİKLER:
-- 1. SECURITY DEFINER: RLS (Row Level Security) kısıtlamalarını aşmak için eklendi. (2. oyuncu hatasını çözer)
-- 2. NESTED ARRAYS: `jsonb_build_array` kullanımı ile verilerin düzleşmesini (flattening) engeller. (Renklerin kaybolma sorununu çözer)
-- 3. LEGACY KEYS: Frontend ile uyumlu olması için `guesses` ve `results` anahtarlarını kullanır.

DROP FUNCTION IF EXISTS submit_turn_guess(uuid,uuid,text,jsonb,boolean);

CREATE OR REPLACE FUNCTION submit_turn_guess(
    p_room_id UUID,
    p_user_id UUID,
    p_guess TEXT,
    p_result JSONB,
    p_is_correct BOOLEAN
)
RETURNS JSONB 
LANGUAGE plpgsql
SECURITY DEFINER -- ÖNEMLİ: Yetki sorunlarını çözer
AS $$
DECLARE
    v_room RECORD;
    v_current_turn INT;
BEGIN
    -- Get room (Locking kaldırıldı - deadlock riskine karşı)
    SELECT * INTO v_room FROM rooms WHERE id = p_room_id;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Room not found';
    END IF;

    -- Get current turn info
    v_current_turn := COALESCE((v_room.config->>'currentTurn')::INT, 0);

    -- Add guess to shared state
    -- ÖNEMLİ: jsonb_build_array kullanılarak sonuçların iç içe array olması sağlanır
    UPDATE rooms SET
        game_state = jsonb_set(
            jsonb_set(
                game_state,
                '{guesses}',
                COALESCE(game_state->'guesses', '[]'::jsonb) || jsonb_build_array(p_guess)
            ),
            '{results}',
            COALESCE(game_state->'results', '[]'::jsonb) || jsonb_build_array(p_result)
        )
    WHERE id = p_room_id;

    -- If correct, update score and clear guesses for next round
    IF p_is_correct THEN
        UPDATE room_participants
        SET score = COALESCE(score, 0) + 100
        WHERE room_id = p_room_id AND user_id = p_user_id;
        
        -- Mark last win for feedback AND clear board
        UPDATE rooms SET
            game_state = jsonb_set(
                jsonb_set(
                    jsonb_set(
                        game_state,
                        '{guesses}',
                        '[]'::jsonb
                    ),
                    '{results}',
                    '[]'::jsonb
                ),
                '{lastWin}',
                jsonb_build_object(
                    'userId', p_user_id,
                    'word', p_guess,
                    'score', 100,
                    'timestamp', EXTRACT(EPOCH FROM NOW()) * 1000
                )
            )
        WHERE id = p_room_id;
    END IF;

    -- Move to next turn
    v_current_turn := v_current_turn + 1;

    -- Update room configuration (turn and timer)
    UPDATE rooms SET
        config = jsonb_set(
            jsonb_set(
                config,
                '{currentTurn}',
                to_jsonb(v_current_turn)
            ),
            '{turnStartTime}',
            to_jsonb(EXTRACT(EPOCH FROM NOW()) * 1000)
        )
    WHERE id = p_room_id;

    RETURN jsonb_build_object('success', true, 'nextTurn', v_current_turn);
END;
$$;
