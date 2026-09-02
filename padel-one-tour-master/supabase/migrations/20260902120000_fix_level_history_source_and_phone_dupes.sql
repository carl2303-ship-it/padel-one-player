/*
  # Fix level history source_id + merge phone duplicate accounts

  1. update_player_rating logs to player_level_history with source_id (server-side)
  2. Merge orphan duplicate player_accounts (+33/+34 same 9 digits)
  3. Restore Dario Arez level from last rated history (4.94)
*/

-- ── 1. update_player_rating v4: server-side history with source_id ──────────

DROP FUNCTION IF EXISTS update_player_rating(UUID, NUMERIC, NUMERIC, BOOLEAN);
DROP FUNCTION IF EXISTS update_player_rating(UUID, NUMERIC, NUMERIC, BOOLEAN, UUID, TEXT);

CREATE OR REPLACE FUNCTION update_player_rating(
  p_player_account_id UUID,
  p_new_level NUMERIC,
  p_new_reliability NUMERIC,
  p_match_won BOOLEAN DEFAULT NULL,
  p_source_id UUID DEFAULT NULL,
  p_match_type TEXT DEFAULT 'tournament'
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_level_before NUMERIC;
  v_match_type TEXT;
BEGIN
  SELECT level INTO v_level_before
  FROM player_accounts
  WHERE id = p_player_account_id;

  UPDATE player_accounts
  SET
    level = p_new_level,
    level_reliability_percent = GREATEST(
      p_new_reliability,
      COALESCE(level_reliability_percent, 0) - 2
    ),
    rated_matches = COALESCE(rated_matches, 0) + 1,
    wins = CASE
      WHEN p_match_won = TRUE THEN COALESCE(wins, 0) + 1
      ELSE COALESCE(wins, 0)
    END,
    losses = CASE
      WHEN p_match_won = FALSE THEN COALESCE(losses, 0) + 1
      ELSE COALESCE(losses, 0)
    END,
    updated_at = now()
  WHERE id = p_player_account_id;

  v_match_type := COALESCE(NULLIF(p_match_type, ''), 'tournament');
  IF v_match_type NOT IN ('tournament', 'open_game') THEN
    v_match_type := 'tournament';
  END IF;

  IF v_level_before IS NOT NULL THEN
    INSERT INTO player_level_history (
      player_account_id,
      level_before,
      level_after,
      delta,
      match_type,
      match_won,
      source_id
    ) VALUES (
      p_player_account_id,
      ROUND(v_level_before, 2),
      ROUND(p_new_level, 2),
      ROUND(p_new_level - v_level_before, 4),
      v_match_type,
      p_match_won,
      p_source_id
    );
  END IF;
END;
$$;

COMMENT ON FUNCTION update_player_rating(UUID, NUMERIC, NUMERIC, BOOLEAN, UUID, TEXT) IS
  'v4: Atualiza nivel/fiabilidade/stats e regista player_level_history com source_id';
GRANT EXECUTE ON FUNCTION update_player_rating(UUID, NUMERIC, NUMERIC, BOOLEAN, UUID, TEXT) TO authenticated;

-- ── 2. Merge phone duplicate accounts (same last 9 digits, same name) ────────

DO $$
DECLARE
  r RECORD;
  v_keep UUID;
  v_drop UUID;
BEGIN
  FOR r IN
    SELECT
      RIGHT(regexp_replace(COALESCE(phone_number, ''), '\D', '', 'g'), 9) AS phone_suffix,
      lower(trim(name)) AS name_norm,
      array_agg(id ORDER BY
        CASE WHEN user_id IS NOT NULL THEN 0 ELSE 1 END,
        COALESCE(rated_matches, 0) DESC,
        COALESCE(level, 0) DESC NULLS LAST,
        created_at ASC
      ) AS ids
    FROM player_accounts
    WHERE phone_number IS NOT NULL
      AND length(regexp_replace(phone_number, '\D', '', 'g')) >= 9
    GROUP BY phone_suffix, name_norm
    HAVING COUNT(*) > 1
  LOOP
    v_keep := r.ids[1];
    FOR i IN 2..array_length(r.ids, 1) LOOP
      v_drop := r.ids[i];

      UPDATE players SET player_account_id = v_keep WHERE player_account_id = v_drop;
      UPDATE league_standings SET player_account_id = v_keep WHERE player_account_id = v_drop;
      UPDATE player_level_history SET player_account_id = v_keep WHERE player_account_id = v_drop;
      UPDATE tournament_invites SET player_account_id = v_keep WHERE player_account_id = v_drop;
      UPDATE super_team_players SET player_account_id = v_keep WHERE player_account_id = v_drop;
      UPDATE push_subscriptions SET player_account_id = v_keep WHERE player_account_id = v_drop;
      UPDATE player_rewards SET player_account_id = v_keep WHERE player_account_id = v_drop;
      UPDATE player_clubs SET player_account_id = v_keep WHERE player_account_id = v_drop;

      DELETE FROM player_accounts WHERE id = v_drop;
      RAISE NOTICE 'Merged duplicate account % into % (phone %, name %)', v_drop, v_keep, r.phone_suffix, r.name_norm;
    END LOOP;
  END LOOP;
END $$;

-- ── 3. Restore Dario Arez (manual edit to 3.80 without history on 2026-09-01) ─

UPDATE player_accounts
SET level = 4.94, updated_at = now()
WHERE id = '62e4bb31-cb02-4bff-9921-45c8722944f9'
  AND level = 3.80;
