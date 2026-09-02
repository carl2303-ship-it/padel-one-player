/*
  Restore player levels corrupted by broken rating reprocess / category sync.

  Only restores accounts where current level differs from the last rated
  player_level_history entry (evidence of an incorrect overwrite).
*/

WITH last_hist AS (
  SELECT DISTINCT ON (player_account_id)
    player_account_id,
    level_after
  FROM player_level_history
  ORDER BY player_account_id, created_at DESC
),
to_restore AS (
  SELECT pa.id, lh.level_after
  FROM player_accounts pa
  JOIN last_hist lh ON lh.player_account_id = pa.id
  WHERE pa.level IS DISTINCT FROM lh.level_after
    AND pa.rated_matches > 5
)
UPDATE player_accounts pa
SET
  level = tr.level_after,
  updated_at = now()
FROM to_restore tr
WHERE pa.id = tr.id;
