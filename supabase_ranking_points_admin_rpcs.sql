-- RPCs de backfill / admin para ranking_point_transactions
-- (aplicado via migração Supabase; ficheiro de referência no repo)

CREATE OR REPLACE FUNCTION public.clear_ranking_point_transactions()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  n integer;
BEGIN
  DELETE FROM ranking_point_transactions WHERE id IS NOT NULL;
  GET DIAGNOSTICS n = ROW_COUNT;
  RETURN n;
END;
$$;

CREATE OR REPLACE FUNCTION public.insert_ranking_point_rows(p_rows jsonb)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  n integer := 0;
BEGIN
  INSERT INTO ranking_point_transactions (
    user_id, organization_id, points_awarded, reason, reference_id, created_at
  )
  SELECT
    (r->>'user_id')::uuid,
    (r->>'organization_id')::uuid,
    (r->>'points_awarded')::int,
    r->>'reason',
    NULLIF(r->>'reference_id', '')::uuid,
    COALESCE(NULLIF(r->>'created_at', '')::timestamptz, now())
  FROM jsonb_array_elements(p_rows) AS r
  WHERE (r->>'user_id') IS NOT NULL
    AND (r->>'organization_id') IS NOT NULL
    AND (r->>'points_awarded') IS NOT NULL
    AND (r->>'reason') IS NOT NULL;

  GET DIAGNOSTICS n = ROW_COUNT;
  RETURN n;
END;
$$;

CREATE OR REPLACE FUNCTION public.list_confirmed_casual_results_12m(p_since timestamptz)
RETURNS TABLE (
  result_id uuid,
  game_id uuid,
  club_id uuid,
  created_at timestamptz,
  team1_score_set1 int,
  team2_score_set1 int,
  team1_score_set2 int,
  team2_score_set2 int,
  team1_score_set3 int,
  team2_score_set3 int
)
LANGUAGE sql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT
    r.id,
    r.game_id,
    g.club_id,
    COALESCE(r.created_at, g.scheduled_at, now()),
    r.team1_score_set1,
    r.team2_score_set1,
    r.team1_score_set2,
    r.team2_score_set2,
    r.team1_score_set3,
    r.team2_score_set3
  FROM open_game_results r
  JOIN open_games g ON g.id = r.game_id
  WHERE r.status = 'confirmed'
    AND g.club_id IS NOT NULL
    AND COALESCE(r.created_at, g.scheduled_at) >= p_since;
$$;

CREATE OR REPLACE FUNCTION public.list_open_game_roster(p_game_id uuid)
RETURNS TABLE (
  player_position int,
  player_account_id uuid,
  user_id uuid
)
LANGUAGE sql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT
    ogp.position AS player_position,
    ogp.player_account_id,
    COALESCE(ogp.user_id, pa.user_id) AS user_id
  FROM open_game_players ogp
  LEFT JOIN player_accounts pa ON pa.id = ogp.player_account_id
  WHERE ogp.game_id = p_game_id
  ORDER BY ogp.position ASC NULLS LAST;
$$;

GRANT EXECUTE ON FUNCTION public.clear_ranking_point_transactions() TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.insert_ranking_point_rows(jsonb) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.list_confirmed_casual_results_12m(timestamptz) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.list_open_game_roster(uuid) TO anon, authenticated, service_role;
