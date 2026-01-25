-- Clear all active games to reset state
DELETE FROM games WHERE status = 'active';

-- Optionally, if you want to clear waiting games too:
-- DELETE FROM games WHERE status = 'waiting';
