-- =====================================================
-- Migration: player_rating_history - Histórico de variação de nível
-- =====================================================
-- Tabela para registar cada alteração de nível por jogador
-- Permite mostrar a variação nos últimos N jogos na Player App
-- =====================================================

-- STEP 1: Criar tabela player_rating_history
CREATE TABLE IF NOT EXISTS player_rating_history (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  player_account_id UUID NOT NULL REFERENCES player_accounts(id) ON DELETE CASCADE,
  old_level   NUMERIC NOT NULL,
  new_level   NUMERIC NOT NULL,
  delta       NUMERIC NOT NULL GENERATED ALWAYS AS (new_level - old_level) STORED,
  source      TEXT NOT NULL DEFAULT 'open_game',  -- 'open_game' | 'tournament' | 'manual'
  source_id   UUID,                               -- open_game_id ou match_id
  match_won   BOOLEAN,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Índice para queries rápidas por jogador
CREATE INDEX IF NOT EXISTS idx_rating_history_player 
  ON player_rating_history(player_account_id, created_at DESC);

-- RLS: cada jogador pode ver só o seu próprio histórico
ALTER TABLE player_rating_history ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Players can view own rating history" ON player_rating_history;
CREATE POLICY "Players can view own rating history"
  ON player_rating_history FOR SELECT
  USING (
    player_account_id IN (
      SELECT id FROM player_accounts WHERE user_id = auth.uid()
    )
  );

-- STEP 2: Atualizar update_player_rating para registar histórico
-- Nota: a versão anterior não registava histórico
DROP FUNCTION IF EXISTS update_player_rating(UUID, NUMERIC, NUMERIC, BOOLEAN);

CREATE OR REPLACE FUNCTION update_player_rating(
  p_player_account_id UUID,
  p_new_level         NUMERIC,
  p_new_reliability   NUMERIC,
  p_match_won         BOOLEAN DEFAULT NULL,   -- TRUE=win, FALSE=loss, NULL=draw
  p_source            TEXT    DEFAULT 'open_game',
  p_source_id         UUID    DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_old_level         NUMERIC;
  v_protected_reliability NUMERIC;
BEGIN
  -- Ler nível actual
  SELECT level INTO v_old_level
  FROM player_accounts
  WHERE id = p_player_account_id;

  -- Fiabilidade protegida: nunca cai mais de 2% por jogo
  SELECT GREATEST(
    p_new_reliability,
    COALESCE(level_reliability_percent, 0) - 2
  ) INTO v_protected_reliability
  FROM player_accounts
  WHERE id = p_player_account_id;

  -- Atualizar player_accounts
  UPDATE player_accounts
  SET
    level                    = p_new_level,
    level_reliability_percent = v_protected_reliability,
    rated_matches            = COALESCE(rated_matches, 0) + 1,
    wins = CASE
      WHEN p_match_won = TRUE  THEN COALESCE(wins, 0) + 1
      ELSE COALESCE(wins, 0)
    END,
    losses = CASE
      WHEN p_match_won = FALSE THEN COALESCE(losses, 0) + 1
      ELSE COALESCE(losses, 0)
    END,
    updated_at               = now()
  WHERE id = p_player_account_id;

  -- Registar no histórico (mesmo que delta = 0, para manter contagem de jogos)
  INSERT INTO player_rating_history
    (player_account_id, old_level, new_level, source, source_id, match_won)
  VALUES
    (p_player_account_id, COALESCE(v_old_level, p_new_level), p_new_level,
     p_source, p_source_id, p_match_won);
END;
$$;

COMMENT ON FUNCTION update_player_rating(UUID, NUMERIC, NUMERIC, BOOLEAN, TEXT, UUID)
  IS 'v4: Atualiza nível, fiabilidade protegida, wins/losses/rated_matches E regista histórico em player_rating_history (SECURITY DEFINER)';

-- Grants
GRANT EXECUTE ON FUNCTION update_player_rating(UUID, NUMERIC, NUMERIC, BOOLEAN, TEXT, UUID) TO authenticated;
GRANT SELECT ON player_rating_history TO authenticated;
