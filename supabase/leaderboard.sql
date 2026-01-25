-- Leaderboard SQL Functions
-- Bu dosya leaderboard (skor tablosu) için gerekli fonksiyonları içerir

-- Performance için composite index
CREATE INDEX IF NOT EXISTS idx_users_score_created ON users(score DESC, created_at DESC);

-- 1. TÜM ZAMANLAR LEADERBOARD
CREATE OR REPLACE FUNCTION get_alltime_leaderboard(limit_count INTEGER DEFAULT 100)
RETURNS TABLE (
  rank BIGINT,
  user_id UUID,
  username TEXT,
  display_name TEXT,
  avatar_url TEXT,
  total_score INTEGER,
  total_wins INTEGER,
  total_games INTEGER
) AS $$
BEGIN
  RETURN QUERY
  WITH alltime_stats AS (
    SELECT 
      CASE 
        WHEN g.winner_id = g.player1_id THEN g.player1_id
        WHEN g.winner_id = g.player2_id THEN g.player2_id
      END as winner,
      CASE 
        WHEN g.winner_id = g.player1_id THEN g.player2_id
        WHEN g.winner_id = g.player2_id THEN g.player1_id
      END as loser,
      g.finished_at
    FROM games g
    WHERE g.status = 'finished' 
      AND g.winner_id IS NOT NULL
      AND g.finished_at IS NOT NULL
  ),
  user_alltime_stats AS (
    SELECT 
      u.id,
      u.username,
      u.display_name,
      u.avatar_url,
      COALESCE(SUM(CASE WHEN ats.winner = u.id THEN 20 ELSE 0 END), 0) - 
      COALESCE(SUM(CASE WHEN ats.loser = u.id THEN 10 ELSE 0 END), 0) as score,
      COUNT(CASE WHEN ats.winner = u.id THEN 1 END)::INTEGER as wins,
      (COUNT(CASE WHEN ats.winner = u.id THEN 1 END) + 
       COUNT(CASE WHEN ats.loser = u.id THEN 1 END))::INTEGER as games
    FROM users u
    LEFT JOIN alltime_stats ats ON (ats.winner = u.id OR ats.loser = u.id)
    GROUP BY u.id, u.username, u.display_name, u.avatar_url
    HAVING COUNT(CASE WHEN ats.winner = u.id THEN 1 END) + 
           COUNT(CASE WHEN ats.loser = u.id THEN 1 END) > 0
  )
  SELECT 
    ROW_NUMBER() OVER (ORDER BY uas.score DESC, uas.wins DESC) as rank,
    uas.id as user_id,
    uas.username,
    uas.display_name,
    uas.avatar_url,
    uas.score::INTEGER as total_score,
    uas.wins as total_wins,
    uas.games as total_games
  FROM user_alltime_stats uas
  ORDER BY uas.score DESC, uas.wins DESC
  LIMIT limit_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. GÜNLÜK LEADERBOARD (Son 24 saat)
CREATE OR REPLACE FUNCTION get_daily_leaderboard(limit_count INTEGER DEFAULT 100)
RETURNS TABLE (
  rank BIGINT,
  user_id UUID,
  username TEXT,
  display_name TEXT,
  avatar_url TEXT,
  daily_score INTEGER,
  daily_wins INTEGER,
  daily_games INTEGER
) AS $$
BEGIN
  RETURN QUERY
  WITH daily_stats AS (
    SELECT 
      CASE 
        WHEN g.winner_id = g.player1_id THEN g.player1_id
        WHEN g.winner_id = g.player2_id THEN g.player2_id
      END as winner,
      CASE 
        WHEN g.winner_id = g.player1_id THEN g.player2_id
        WHEN g.winner_id = g.player2_id THEN g.player1_id
      END as loser,
      g.finished_at
    FROM games g
    WHERE g.status = 'finished' 
      AND g.winner_id IS NOT NULL
      AND g.finished_at IS NOT NULL
      AND g.finished_at >= NOW() - INTERVAL '24 hours'
  ),
  user_daily_stats AS (
    SELECT 
      u.id,
      u.username,
      u.display_name,
      u.avatar_url,
      COALESCE(SUM(CASE WHEN ds.winner = u.id THEN 20 ELSE 0 END), 0) - 
      COALESCE(SUM(CASE WHEN ds.loser = u.id THEN 10 ELSE 0 END), 0) as score,
      COUNT(CASE WHEN ds.winner = u.id THEN 1 END)::INTEGER as wins,
      (COUNT(CASE WHEN ds.winner = u.id THEN 1 END) + 
       COUNT(CASE WHEN ds.loser = u.id THEN 1 END))::INTEGER as games
    FROM users u
    LEFT JOIN daily_stats ds ON (ds.winner = u.id OR ds.loser = u.id)
    GROUP BY u.id, u.username, u.display_name, u.avatar_url
    HAVING COUNT(CASE WHEN ds.winner = u.id THEN 1 END) + 
           COUNT(CASE WHEN ds.loser = u.id THEN 1 END) > 0
  )
  SELECT 
    ROW_NUMBER() OVER (ORDER BY uds.score DESC, uds.wins DESC) as rank,
    uds.id as user_id,
    uds.username,
    uds.display_name,
    uds.avatar_url,
    uds.score::INTEGER as daily_score,
    uds.wins as daily_wins,
    uds.games as daily_games
  FROM user_daily_stats uds
  ORDER BY uds.score DESC, uds.wins DESC
  LIMIT limit_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. HAFTALIK LEADERBOARD (Son 7 gün)
CREATE OR REPLACE FUNCTION get_weekly_leaderboard(limit_count INTEGER DEFAULT 100)
RETURNS TABLE (
  rank BIGINT,
  user_id UUID,
  username TEXT,
  display_name TEXT,
  avatar_url TEXT,
  weekly_score INTEGER,
  weekly_wins INTEGER,
  weekly_games INTEGER
) AS $$
BEGIN
  RETURN QUERY
  WITH weekly_stats AS (
    SELECT 
      CASE 
        WHEN g.winner_id = g.player1_id THEN g.player1_id
        WHEN g.winner_id = g.player2_id THEN g.player2_id
      END as winner,
      CASE 
        WHEN g.winner_id = g.player1_id THEN g.player2_id
        WHEN g.winner_id = g.player2_id THEN g.player1_id
      END as loser,
      g.finished_at
    FROM games g
    WHERE g.status = 'finished' 
      AND g.winner_id IS NOT NULL
      AND g.finished_at IS NOT NULL
      AND g.finished_at >= NOW() - INTERVAL '7 days'
  ),
  user_weekly_stats AS (
    SELECT 
      u.id,
      u.username,
      u.display_name,
      u.avatar_url,
      COALESCE(SUM(CASE WHEN ws.winner = u.id THEN 20 ELSE 0 END), 0) - 
      COALESCE(SUM(CASE WHEN ws.loser = u.id THEN 10 ELSE 0 END), 0) as score,
      COUNT(CASE WHEN ws.winner = u.id THEN 1 END)::INTEGER as wins,
      (COUNT(CASE WHEN ws.winner = u.id THEN 1 END) + 
       COUNT(CASE WHEN ws.loser = u.id THEN 1 END))::INTEGER as games
    FROM users u
    LEFT JOIN weekly_stats ws ON (ws.winner = u.id OR ws.loser = u.id)
    GROUP BY u.id, u.username, u.display_name, u.avatar_url
    HAVING COUNT(CASE WHEN ws.winner = u.id THEN 1 END) + 
           COUNT(CASE WHEN ws.loser = u.id THEN 1 END) > 0
  )
  SELECT 
    ROW_NUMBER() OVER (ORDER BY uws.score DESC, uws.wins DESC) as rank,
    uws.id as user_id,
    uws.username,
    uws.display_name,
    uws.avatar_url,
    uws.score::INTEGER as weekly_score,
    uws.wins as weekly_wins,
    uws.games as weekly_games
  FROM user_weekly_stats uws
  ORDER BY uws.score DESC, uws.wins DESC
  LIMIT limit_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 4. AYLIK LEADERBOARD (Son 30 gün)
CREATE OR REPLACE FUNCTION get_monthly_leaderboard(limit_count INTEGER DEFAULT 100)
RETURNS TABLE (
  rank BIGINT,
  user_id UUID,
  username TEXT,
  display_name TEXT,
  avatar_url TEXT,
  monthly_score INTEGER,
  monthly_wins INTEGER,
  monthly_games INTEGER
) AS $$
BEGIN
  RETURN QUERY
  WITH monthly_stats AS (
    SELECT 
      CASE 
        WHEN g.winner_id = g.player1_id THEN g.player1_id
        WHEN g.winner_id = g.player2_id THEN g.player2_id
      END as winner,
      CASE 
        WHEN g.winner_id = g.player1_id THEN g.player2_id
        WHEN g.winner_id = g.player2_id THEN g.player1_id
      END as loser,
      g.finished_at
    FROM games g
    WHERE g.status = 'finished' 
      AND g.winner_id IS NOT NULL
      AND g.finished_at IS NOT NULL
      AND g.finished_at >= NOW() - INTERVAL '30 days'
  ),
  user_monthly_stats AS (
    SELECT 
      u.id,
      u.username,
      u.display_name,
      u.avatar_url,
      COALESCE(SUM(CASE WHEN ms.winner = u.id THEN 20 ELSE 0 END), 0) - 
      COALESCE(SUM(CASE WHEN ms.loser = u.id THEN 10 ELSE 0 END), 0) as score,
      COUNT(CASE WHEN ms.winner = u.id THEN 1 END)::INTEGER as wins,
      (COUNT(CASE WHEN ms.winner = u.id THEN 1 END) + 
       COUNT(CASE WHEN ms.loser = u.id THEN 1 END))::INTEGER as games
    FROM users u
    LEFT JOIN monthly_stats ms ON (ms.winner = u.id OR ms.loser = u.id)
    GROUP BY u.id, u.username, u.display_name, u.avatar_url
    HAVING COUNT(CASE WHEN ms.winner = u.id THEN 1 END) + 
           COUNT(CASE WHEN ms.loser = u.id THEN 1 END) > 0
  )
  SELECT 
    ROW_NUMBER() OVER (ORDER BY ums.score DESC, ums.wins DESC) as rank,
    ums.id as user_id,
    ums.username,
    ums.display_name,
    ums.avatar_url,
    ums.score::INTEGER as monthly_score,
    ums.wins as monthly_wins,
    ums.games as monthly_games
  FROM user_monthly_stats ums
  ORDER BY ums.score DESC, ums.wins DESC
  LIMIT limit_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 5. YILLIK LEADERBOARD (Son 365 gün)
CREATE OR REPLACE FUNCTION get_yearly_leaderboard(limit_count INTEGER DEFAULT 100)
RETURNS TABLE (
  rank BIGINT,
  user_id UUID,
  username TEXT,
  display_name TEXT,
  avatar_url TEXT,
  yearly_score INTEGER,
  yearly_wins INTEGER,
  yearly_games INTEGER
) AS $$
BEGIN
  RETURN QUERY
  WITH yearly_stats AS (
    SELECT 
      CASE 
        WHEN g.winner_id = g.player1_id THEN g.player1_id
        WHEN g.winner_id = g.player2_id THEN g.player2_id
      END as winner,
      CASE 
        WHEN g.winner_id = g.player1_id THEN g.player2_id
        WHEN g.winner_id = g.player2_id THEN g.player1_id
      END as loser,
      g.finished_at
    FROM games g
    WHERE g.status = 'finished' 
      AND g.winner_id IS NOT NULL
      AND g.finished_at IS NOT NULL
      AND g.finished_at >= NOW() - INTERVAL '365 days'
  ),
  user_yearly_stats AS (
    SELECT 
      u.id,
      u.username,
      u.display_name,
      u.avatar_url,
      COALESCE(SUM(CASE WHEN ys.winner = u.id THEN 20 ELSE 0 END), 0) - 
      COALESCE(SUM(CASE WHEN ys.loser = u.id THEN 10 ELSE 0 END), 0) as score,
      COUNT(CASE WHEN ys.winner = u.id THEN 1 END)::INTEGER as wins,
      (COUNT(CASE WHEN ys.winner = u.id THEN 1 END) + 
       COUNT(CASE WHEN ys.loser = u.id THEN 1 END))::INTEGER as games
    FROM users u
    LEFT JOIN yearly_stats ys ON (ys.winner = u.id OR ys.loser = u.id)
    GROUP BY u.id, u.username, u.display_name, u.avatar_url
    HAVING COUNT(CASE WHEN ys.winner = u.id THEN 1 END) + 
           COUNT(CASE WHEN ys.loser = u.id THEN 1 END) > 0
  )
  SELECT 
    ROW_NUMBER() OVER (ORDER BY uys.score DESC, uys.wins DESC) as rank,
    uys.id as user_id,
    uys.username,
    uys.display_name,
    uys.avatar_url,
    uys.score::INTEGER as yearly_score,
    uys.wins as yearly_wins,
    uys.games as yearly_games
  FROM user_yearly_stats uys
  ORDER BY uys.score DESC, uys.wins DESC
  LIMIT limit_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- RLS Policy: Herkes leaderboard'u görebilir
-- (Fonksiyonlar SECURITY DEFINER olduğu için otomatik erişim var)
