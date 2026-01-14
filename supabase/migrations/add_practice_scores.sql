-- Migration: Add Practice Mode Scoring System
-- Adds table for tracking practice mode scores and personal bests

-- Practice scores table
CREATE TABLE IF NOT EXISTS practice_scores (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  game_mode TEXT NOT NULL, -- 'timed' or 'relaxed'
  word_length INT NOT NULL, -- 4, 5, 6, 7, or 0 for mixed
  score INT NOT NULL,
  words_completed INT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_practice_scores_user ON practice_scores(user_id);
CREATE INDEX IF NOT EXISTS idx_practice_scores_mode ON practice_scores(game_mode, word_length);
CREATE INDEX IF NOT EXISTS idx_practice_scores_user_mode ON practice_scores(user_id, game_mode, word_length);

-- RLS Policies
ALTER TABLE practice_scores ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own scores"
  ON practice_scores FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own scores"
  ON practice_scores FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Function to get personal best
CREATE OR REPLACE FUNCTION get_personal_best(
  p_user_id UUID,
  p_game_mode TEXT,
  p_word_length INT
)
RETURNS INT AS $$
DECLARE
  v_best_score INT;
BEGIN
  SELECT MAX(score) INTO v_best_score
  FROM practice_scores
  WHERE user_id = p_user_id
    AND game_mode = p_game_mode
    AND word_length = p_word_length;
  
  RETURN COALESCE(v_best_score, 0);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
