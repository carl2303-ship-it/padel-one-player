/*
  player_level_history + reverse_player_rating

  - Guarda cada alteração de nível com source_id (match ou open_game)
  - Permite reverter ratings quando um resultado é editado / disputado
*/

CREATE TABLE IF NOT EXISTS player_level_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  player_account_id UUID NOT NULL REFERENCES player_accounts(id) ON DELETE CASCADE,
  level_before NUMERIC(6,2) NOT NULL,
  level_after NUMERIC(6,2) NOT NULL,
  delta NUMERIC(8,4) NOT NULL,
  match_type TEXT NOT NULL CHECK (match_type IN ('tournament', 'open_game')),
  match_won BOOLEAN,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE player_level_history
  ADD COLUMN IF NOT EXISTS source_id UUID;

CREATE INDEX IF NOT EXISTS idx_player_level_history_player_created
  ON player_level_history (player_account_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_player_level_history_source
  ON player_level_history (source_id)
  WHERE source_id IS NOT NULL;

ALTER TABLE player_level_history ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Players can read own level history" ON player_level_history;
DROP POLICY IF EXISTS "Authenticated can read level history" ON player_level_history;
CREATE POLICY "Authenticated can read level history"
  ON player_level_history FOR SELECT
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS "Anon can read level history" ON player_level_history;
CREATE POLICY "Anon can read level history"
  ON player_level_history FOR SELECT
  TO anon
  USING (true);

DROP POLICY IF EXISTS "Authenticated can insert level history" ON player_level_history;
CREATE POLICY "Authenticated can insert level history"
  ON player_level_history FOR INSERT
  TO authenticated
  WITH CHECK (true);

DROP POLICY IF EXISTS "Authenticated can delete level history for reverse" ON player_level_history;
CREATE POLICY "Authenticated can delete level history for reverse"
  ON player_level_history FOR DELETE
  TO authenticated
  USING (true);

CREATE OR REPLACE FUNCTION reverse_player_rating(
  p_player_account_id UUID,
  p_delta NUMERIC,
  p_match_won BOOLEAN DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE player_accounts
  SET
    level = GREATEST(0.5, COALESCE(level, 3.0) - COALESCE(p_delta, 0)),
    rated_matches = GREATEST(0, COALESCE(rated_matches, 0) - 1),
    wins = CASE
      WHEN p_match_won = TRUE THEN GREATEST(0, COALESCE(wins, 0) - 1)
      ELSE COALESCE(wins, 0)
    END,
    losses = CASE
      WHEN p_match_won = FALSE THEN GREATEST(0, COALESCE(losses, 0) - 1)
      ELSE COALESCE(losses, 0)
    END,
    updated_at = now()
  WHERE id = p_player_account_id;
END;
$$;

COMMENT ON FUNCTION reverse_player_rating(UUID, NUMERIC, BOOLEAN) IS
  'Undo one update_player_rating application using the stored delta';
GRANT EXECUTE ON FUNCTION reverse_player_rating(UUID, NUMERIC, BOOLEAN) TO authenticated;

CREATE OR REPLACE FUNCTION reverse_rating_for_source(p_source_id UUID)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  r RECORD;
  reversed_count INTEGER := 0;
BEGIN
  IF p_source_id IS NULL THEN
    RETURN 0;
  END IF;

  FOR r IN
    SELECT id, player_account_id, delta, match_won
    FROM player_level_history
    WHERE source_id = p_source_id
  LOOP
    PERFORM reverse_player_rating(r.player_account_id, r.delta, r.match_won);
    DELETE FROM player_level_history WHERE id = r.id;
    reversed_count := reversed_count + 1;
  END LOOP;

  RETURN reversed_count;
END;
$$;

COMMENT ON FUNCTION reverse_rating_for_source(UUID) IS
  'Reverse all ratings logged for a match/open_game source_id and delete history';
GRANT EXECUTE ON FUNCTION reverse_rating_for_source(UUID) TO authenticated;
