-- Yeni Skor Sistemi
-- Sadece yabancılarla (arkadaş olmayanlarla) oynanan oyunlar skor tablosuna sayılır
-- Turnuva sıralamasına göre farklı puanlar

-- 1. Oyun bittiğinde skor hesaplama fonksiyonu
CREATE OR REPLACE FUNCTION calculate_game_score(
    p_game_id UUID,
    p_winner_id UUID,
    p_loser_id UUID,
    p_game_type TEXT, -- 'quick_match', 'tournament', 'friend'
    p_tournament_rank INTEGER DEFAULT NULL -- 1, 2, 3+ için
)
RETURNS VOID AS $$
DECLARE
    v_are_friends BOOLEAN;
    v_winner_points INTEGER := 0;
    v_loser_points INTEGER := 0;
BEGIN
    -- Arkadaş mı kontrol et
    SELECT EXISTS (
        SELECT 1 FROM friendships
        WHERE (user1_id = p_winner_id AND user2_id = p_loser_id)
           OR (user1_id = p_loser_id AND user2_id = p_winner_id)
        AND status = 'accepted'
    ) INTO v_are_friends;

    -- Arkadaşlarsa skor tablosuna sayma
    IF v_are_friends THEN
        RETURN;
    END IF;

    -- Puan hesaplama
    IF p_game_type = 'tournament' THEN
        -- Turnuva puanları
        CASE p_tournament_rank
            WHEN 1 THEN 
                v_winner_points := 50;  -- 1. lik
            WHEN 2 THEN 
                v_winner_points := 35;  -- 2. lik
            WHEN 3 THEN 
                v_winner_points := 25;  -- 3. lük
            ELSE 
                v_winner_points := 15;  -- 4+ 
        END CASE;
        v_loser_points := 0; -- Kaybedene puan yok
    ELSIF p_game_type = 'quick_match' THEN
        -- Hızlı oyun (1v1)
        v_winner_points := 20;
        v_loser_points := 0; -- Kaybedene puan yok
    ELSE
        -- Diğer (arkadaş oyunları buraya gelmemeli ama yine de)
        RETURN;
    END IF;

    -- Kazanan için skor güncelle
    UPDATE users
    SET score = score + v_winner_points,
        wins = wins + 1,
        total_games = total_games + 1
    WHERE id = p_winner_id;

    -- Kaybeden için sadece istatistik güncelle (puan değişmez)
    UPDATE users
    SET losses = losses + 1,
        total_games = total_games + 1
    WHERE id = p_loser_id;

END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. Oyun bittiğinde otomatik skor hesaplama trigger'ı
CREATE OR REPLACE FUNCTION trigger_calculate_game_score()
RETURNS TRIGGER AS $$
DECLARE
    v_game_type TEXT;
    v_tournament_rank INTEGER;
BEGIN
    -- Sadece finished durumunda ve winner varsa
    IF NEW.status = 'finished' AND NEW.winner_id IS NOT NULL THEN
        
        -- Oyun tipini belirle
        IF NEW.game_mode = 'tournament' THEN
            v_game_type := 'tournament';
            -- Turnuva sıralamasını config'den al (eğer varsa)
            v_tournament_rank := (NEW.config->>'tournamentRank')::INTEGER;
            IF v_tournament_rank IS NULL THEN
                v_tournament_rank := 4; -- Default 4+
            END IF;
        ELSIF NEW.game_mode = 'quick_match' THEN
            v_game_type := 'quick_match';
        ELSE
            v_game_type := 'friend'; -- Arkadaş oyunu
        END IF;

        -- Skor hesapla
        PERFORM calculate_game_score(
            NEW.id,
            NEW.winner_id,
            CASE 
                WHEN NEW.winner_id = NEW.player1_id THEN NEW.player2_id
                ELSE NEW.player1_id
            END,
            v_game_type,
            v_tournament_rank
        );
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger'ı oluştur
DROP TRIGGER IF EXISTS on_game_finished_calculate_score ON games;
CREATE TRIGGER on_game_finished_calculate_score
    AFTER UPDATE ON games
    FOR EACH ROW
    WHEN (OLD.status IS DISTINCT FROM NEW.status AND NEW.status = 'finished')
    EXECUTE FUNCTION trigger_calculate_game_score();

-- 3. Eski skorları sıfırla ve yeniden hesapla (opsiyonel - sadece bir kere çalıştır)
-- UNCOMMENT TO RESET SCORES:
-- UPDATE users SET score = 0, wins = 0, losses = 0, total_games = 0;
