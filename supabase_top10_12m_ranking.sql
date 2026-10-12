-- =============================================================================
-- NOTA: A regra "Top 10 Best Results" foi revertida a pedido do produto.
-- A vista canónica volta a somar TODOS os eventos dos últimos 12 meses.
-- Ver também: supabase_rolling_12m_ranking.sql
-- =============================================================================

DROP VIEW IF EXISTS rolling_12m_rankings;

CREATE VIEW rolling_12m_rankings
WITH (security_invoker = true)
AS
SELECT
  user_id,
  organization_id,
  SUM(points_awarded) AS total_points,
  COUNT(DISTINCT reference_id)::bigint AS total_events,
  MAX(created_at) AS last_activity,
  COUNT(*)::bigint AS counted_events
FROM ranking_point_transactions
WHERE created_at >= (NOW() - INTERVAL '12 months')
GROUP BY user_id, organization_id
ORDER BY total_points DESC;

GRANT SELECT ON rolling_12m_rankings TO anon, authenticated;
