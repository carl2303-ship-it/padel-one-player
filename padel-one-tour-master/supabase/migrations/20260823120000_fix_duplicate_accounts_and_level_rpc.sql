/*
  # Fix duplicate player_accounts + level update RPC

  1. Re-run dedup: one auth user_id → one player_account (keep best phone match)
  2. update_player_account_level: accept player_account_id OR match phone by last 9 digits
*/

-- Dedup: unlink secondary accounts sharing the same auth user_id
WITH ranked AS (
  SELECT
    pa.id AS player_account_id,
    pa.user_id,
    pa.email AS pa_email,
    pa.phone_number,
    pa.name,
    u.email AS auth_email,
    ROW_NUMBER() OVER (
      PARTITION BY pa.user_id
      ORDER BY
        CASE
          WHEN NULLIF(regexp_replace(COALESCE(pa.phone_number, ''), '\D', '', 'g'), '') IS NOT NULL
           AND (
             regexp_replace(COALESCE(u.phone, ''), '\D', '', 'g')
               LIKE '%' || RIGHT(regexp_replace(pa.phone_number, '\D', '', 'g'), 9)
             OR regexp_replace(COALESCE(u.raw_user_meta_data->>'phone_number', ''), '\D', '', 'g')
               LIKE '%' || RIGHT(regexp_replace(pa.phone_number, '\D', '', 'g'), 9)
           )
          THEN 0 ELSE 1
        END,
        CASE
          WHEN lower(COALESCE(u.raw_user_meta_data->>'display_name', '')) <> ''
           AND lower(COALESCE(pa.name, '')) <> ''
           AND lower(u.raw_user_meta_data->>'display_name') LIKE '%' || lower(split_part(trim(pa.name), ' ', 1)) || '%'
          THEN 0 ELSE 1
        END,
        CASE
          WHEN lower(COALESCE(pa.email, '')) <> ''
           AND lower(COALESCE(u.email, '')) = lower(pa.email)
          THEN 0 ELSE 1
        END,
        pa.created_at ASC NULLS LAST,
        pa.id ASC
    ) AS rn
  FROM public.player_accounts pa
  JOIN auth.users u ON u.id = pa.user_id
  WHERE pa.user_id IS NOT NULL
),
dupes AS (
  SELECT * FROM ranked
  WHERE user_id IN (
    SELECT user_id
    FROM public.player_accounts
    WHERE user_id IS NOT NULL
    GROUP BY user_id
    HAVING COUNT(*) > 1
  )
)
UPDATE public.player_accounts pa
SET
  user_id = NULL,
  email = CASE
    WHEN d.pa_email IS NOT NULL
     AND d.auth_email IS NOT NULL
     AND lower(d.pa_email) = lower(d.auth_email)
    THEN regexp_replace(COALESCE(pa.phone_number, ''), '\D', '', 'g') || '@boostpadel.app'
    ELSE pa.email
  END,
  updated_at = now()
FROM dupes d
WHERE pa.id = d.player_account_id
  AND d.rn > 1;

CREATE UNIQUE INDEX IF NOT EXISTS player_accounts_user_id_unique
  ON public.player_accounts (user_id)
  WHERE user_id IS NOT NULL;

DROP FUNCTION IF EXISTS update_player_account_level(TEXT, TEXT, NUMERIC, NUMERIC);
DROP FUNCTION IF EXISTS update_player_account_level(TEXT, UUID, TEXT, NUMERIC, NUMERIC);

-- Level/category update: by account id (preferred) or phone suffix match
CREATE OR REPLACE FUNCTION update_player_account_level(
  p_phone_number TEXT DEFAULT NULL,
  p_player_account_id UUID DEFAULT NULL,
  p_player_category TEXT DEFAULT NULL,
  p_level NUMERIC DEFAULT NULL,
  p_level_reliability_percent NUMERIC DEFAULT NULL
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_updated_id UUID;
  v_name TEXT;
  v_phone_suffix TEXT;
BEGIN
  IF p_player_account_id IS NOT NULL THEN
    UPDATE player_accounts
    SET
      player_category = COALESCE(p_player_category, player_category),
      level = COALESCE(p_level, level),
      level_reliability_percent = COALESCE(p_level_reliability_percent, level_reliability_percent),
      updated_at = NOW()
    WHERE id = p_player_account_id
    RETURNING id, name INTO v_updated_id, v_name;
  ELSIF p_phone_number IS NOT NULL AND length(regexp_replace(p_phone_number, '\D', '', 'g')) >= 9 THEN
    v_phone_suffix := RIGHT(regexp_replace(p_phone_number, '\D', '', 'g'), 9);

    UPDATE player_accounts
    SET
      player_category = COALESCE(p_player_category, player_category),
      level = COALESCE(p_level, level),
      level_reliability_percent = COALESCE(p_level_reliability_percent, level_reliability_percent),
      updated_at = NOW()
    WHERE RIGHT(regexp_replace(COALESCE(phone_number, ''), '\D', '', 'g'), 9) = v_phone_suffix
    RETURNING id, name INTO v_updated_id, v_name;
  END IF;

  IF v_updated_id IS NULL THEN
    RETURN json_build_object(
      'success', false,
      'error', 'Player account not found',
      'phone', p_phone_number,
      'player_account_id', p_player_account_id
    );
  END IF;

  RETURN json_build_object('success', true, 'id', v_updated_id, 'name', v_name);
END;
$$;

GRANT EXECUTE ON FUNCTION update_player_account_level(TEXT, UUID, TEXT, NUMERIC, NUMERIC) TO authenticated;
