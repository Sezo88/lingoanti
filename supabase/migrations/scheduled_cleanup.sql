-- Veritabanı Temizliği için SQL
-- Bu fonksiyon ve triggerlar, yeni kayıt eklendiğinde 30 günden eski kayıtları otomatik siler.

-- 1. Temizlik Fonksiyonu
CREATE OR REPLACE FUNCTION cleanup_old_logs()
RETURNS TRIGGER AS $$
BEGIN
    -- 30 günden eski reklam izleme kayıtlarını sil
    DELETE FROM ad_rewards 
    WHERE created_at < NOW() - INTERVAL '30 days';

    -- 30 günden eski joker kullanım kayıtlarını sil
    DELETE FROM joker_usage 
    WHERE used_at < NOW() - INTERVAL '30 days';

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 2. Triggerlar (Tetikleyiciler)
-- Her yeni reklam izlendiğinde temizliği çalıştır
DROP TRIGGER IF EXISTS trigger_cleanup_ads ON ad_rewards;
CREATE TRIGGER trigger_cleanup_ads
    AFTER INSERT ON ad_rewards
    FOR EACH STATEMENT
    EXECUTE FUNCTION cleanup_old_logs();

-- Her yeni joker kullanıldığında temizliği çalıştır
DROP TRIGGER IF EXISTS trigger_cleanup_jokers ON joker_usage;
CREATE TRIGGER trigger_cleanup_jokers
    AFTER INSERT ON joker_usage
    FOR EACH STATEMENT
    EXECUTE FUNCTION cleanup_old_logs();
