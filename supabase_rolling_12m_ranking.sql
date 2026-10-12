-- =============================================================================
-- Padel ONE / APC — Ranking Deslizante de 12 Meses
-- Tabela de transações + vista rolling (pontos expiram após 365 dias sem DELETE)
--
-- Nota: não existe tabela `organizations` no schema actual. No ecossistema
-- Padel ONE, a organização de ranking corresponde ao clube (`clubs.id`).
-- Criamos `organizations` espelhada a partir de `clubs` (mesmo UUID) para
-- cumprir o contrato organization_id e manter FK estável.
-- =============================================================================

-- 0. Organizações (espelho de clubs para o contrato APC / ranking)
CREATE TABLE IF NOT EXISTS organizations (
  id UUID PRIMARY KEY REFERENCES clubs(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

INSERT INTO organizations (id, name)
SELECT id, name FROM clubs
ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name;

ALTER TABLE organizations ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow public read organizations" ON organizations;
CREATE POLICY "Allow public read organizations" ON organizations
  FOR SELECT USING (true);

-- Manter organizations alinhada com clubs (novos clubes)
CREATE OR REPLACE FUNCTION sync_organization_from_club()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  INSERT INTO organizations (id, name)
  VALUES (NEW.id, NEW.name)
  ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_organization_from_club ON clubs;
CREATE TRIGGER trg_sync_organization_from_club
  AFTER INSERT OR UPDATE OF name ON clubs
  FOR EACH ROW
  EXECUTE FUNCTION sync_organization_from_club();

-- 1. Tabela de Histórico de Transações de Pontos
CREATE TABLE IF NOT EXISTS ranking_point_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  points_awarded INT NOT NULL,
  reason VARCHAR(100) NOT NULL, -- ex: 'tournament_winner', 'tournament_finalist', 'friendly_win'
  reference_id UUID,             -- ID do torneio ou do jogo
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ranking_point_tx_user_org
  ON ranking_point_transactions (user_id, organization_id);

CREATE INDEX IF NOT EXISTS idx_ranking_point_tx_created
  ON ranking_point_transactions (created_at DESC);

CREATE INDEX IF NOT EXISTS idx_ranking_point_tx_reference
  ON ranking_point_transactions (reference_id)
  WHERE reference_id IS NOT NULL;

-- Habilitar RLS
ALTER TABLE ranking_point_transactions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow public read ranking_point_transactions" ON ranking_point_transactions;
CREATE POLICY "Allow public read ranking_point_transactions" ON ranking_point_transactions
  FOR SELECT USING (true);

DROP POLICY IF EXISTS "Allow authenticated insert ranking_point_transactions" ON ranking_point_transactions;
CREATE POLICY "Allow authenticated insert ranking_point_transactions" ON ranking_point_transactions
  FOR INSERT TO authenticated
  WITH CHECK (true);

-- 2. ÚNICA VISTA SQL: Ranking Deslizante dos Últimos 12 Meses (Rolling 365 Days)
-- Calcula a soma dos pontos dos ultimos 12 meses em tempo real.
CREATE OR REPLACE VIEW rolling_12m_rankings
WITH (security_invoker = true)
AS
SELECT
  user_id,
  organization_id,
  SUM(points_awarded) AS total_points,
  COUNT(DISTINCT reference_id) AS total_events,
  MAX(created_at) AS last_activity
FROM ranking_point_transactions
WHERE created_at >= (NOW() - INTERVAL '12 months')
GROUP BY user_id, organization_id
ORDER BY total_points DESC;

GRANT SELECT ON rolling_12m_rankings TO anon, authenticated;
GRANT SELECT ON organizations TO anon, authenticated;
GRANT SELECT ON ranking_point_transactions TO anon, authenticated;
GRANT INSERT ON ranking_point_transactions TO authenticated;
