-- =============================================================================
-- Padel ONE / APC — Ranking Deslizante: Top 10 Melhores Resultados (12 meses)
-- Conta apenas as 10 melhores pontuações de cada jogador por organização.
-- Substitui a agregação anterior (soma de todos os eventos).
-- =============================================================================

-- DROP necessário: CREATE OR REPLACE não pode renomear/reordenar colunas da vista.
DROP VIEW IF EXISTS rolling_12m_rankings;

CREATE VIEW rolling_12m_rankings
WITH (security_invoker = true)
AS
WITH ranked_scores AS (
  SELECT
    user_id,
    organization_id,
    points_awarded,
    reason,
    reference_id,
    created_at,
    ROW_NUMBER() OVER (
      PARTITION BY user_id, organization_id
      ORDER BY points_awarded DESC, created_at DESC
    ) AS score_rank
  FROM ranking_point_transactions
  WHERE created_at >= (NOW() - INTERVAL '12 months')
)
SELECT
  user_id,
  organization_id,
  SUM(points_awarded) AS total_points,
  COUNT(score_rank)::bigint AS total_events,   -- compat (máx. 10)
  MAX(created_at) AS last_activity,
  COUNT(score_rank)::bigint AS counted_events  -- nome canónico da regra Top 10
FROM ranked_scores
WHERE score_rank <= 10
GROUP BY user_id, organization_id
ORDER BY total_points DESC;

GRANT SELECT ON rolling_12m_rankings TO anon, authenticated;
