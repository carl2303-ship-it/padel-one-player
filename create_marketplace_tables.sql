-- ============================================
-- MARKETPLACE for Padel One Player (HUB-114)
-- Project: rqiwnxcexsccguruiteq (padel1)
-- Run in Supabase Dashboard > SQL Editor
--
-- Alinhado com Hub HUB-115 (admin cf9a39c):
--   source=store, store_product_id, title, price, description,
--   photos (≤4), category, condition=novo, seller_type=store,
--   status active|inactive|sold
-- Upsert Hub: onConflict store_product_id → UNIQUE(store_product_id)
-- ============================================

CREATE TABLE IF NOT EXISTS marketplace_listings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  description text,
  category text NOT NULL
    CHECK (category IN ('raquetes', 'acessorios', 'nutricao', 'outros')),
  condition text NOT NULL
    CHECK (condition IN ('novo', 'usado')),
  photos text[] NOT NULL DEFAULT '{}',
  -- EUR (Hub + Player usam a coluna "price")
  price numeric(10, 2) NOT NULL CHECK (price >= 0),
  source text NOT NULL DEFAULT 'player'
    CHECK (source IN ('player', 'store')),
  seller_type text NOT NULL DEFAULT 'player'
    CHECK (seller_type IN ('player', 'store')),
  -- Nullable quando source=store (Hub não envia seller player/auth ids)
  seller_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  seller_player_account_id uuid REFERENCES player_accounts(id) ON DELETE SET NULL,
  -- Unique para upsert Hub onConflict: 'store_product_id' (NULLs permitidos para player)
  store_product_id text,
  store_url text,
  status text NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'inactive', 'sold')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT marketplace_listings_photos_max CHECK (cardinality(photos) <= 4),
  CONSTRAINT marketplace_listings_seller_check CHECK (
    (source = 'player'
      AND seller_type = 'player'
      AND seller_user_id IS NOT NULL
      AND seller_player_account_id IS NOT NULL)
    OR (source = 'store' AND seller_type = 'store')
  )
);

-- Idempotência Store (PostgREST upsert onConflict=store_product_id)
CREATE UNIQUE INDEX IF NOT EXISTS marketplace_listings_store_product_uidx
  ON marketplace_listings (store_product_id);

CREATE INDEX IF NOT EXISTS marketplace_listings_status_created_idx
  ON marketplace_listings (status, created_at DESC);

CREATE INDEX IF NOT EXISTS marketplace_listings_category_idx
  ON marketplace_listings (category)
  WHERE status = 'active';

CREATE INDEX IF NOT EXISTS marketplace_listings_condition_idx
  ON marketplace_listings (condition)
  WHERE status = 'active';

CREATE INDEX IF NOT EXISTS marketplace_listings_seller_user_idx
  ON marketplace_listings (seller_user_id);

CREATE INDEX IF NOT EXISTS marketplace_listings_seller_player_idx
  ON marketplace_listings (seller_player_account_id);

CREATE INDEX IF NOT EXISTS marketplace_listings_source_idx
  ON marketplace_listings (source);

CREATE OR REPLACE FUNCTION marketplace_listings_set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS marketplace_listings_updated_at ON marketplace_listings;
CREATE TRIGGER marketplace_listings_updated_at
  BEFORE UPDATE ON marketplace_listings
  FOR EACH ROW
  EXECUTE FUNCTION marketplace_listings_set_updated_at();

ALTER TABLE marketplace_listings ENABLE ROW LEVEL SECURITY;

-- Authenticated: lê activos; dono lê os seus (qualquer status)
DROP POLICY IF EXISTS "Read active or own marketplace listings" ON marketplace_listings;
CREATE POLICY "Read active or own marketplace listings" ON marketplace_listings
  FOR SELECT TO authenticated
  USING (
    status = 'active'
    OR auth.uid() = seller_user_id
  );

-- Anon também pode ver activos (lista pública se sessão falhar)
DROP POLICY IF EXISTS "Anon read active marketplace listings" ON marketplace_listings;
CREATE POLICY "Anon read active marketplace listings" ON marketplace_listings
  FOR SELECT TO anon
  USING (status = 'active');

-- Jogadores criam só os seus (source=player)
DROP POLICY IF EXISTS "Players insert own marketplace listings" ON marketplace_listings;
CREATE POLICY "Players insert own marketplace listings" ON marketplace_listings
  FOR INSERT TO authenticated
  WITH CHECK (
    auth.uid() = seller_user_id
    AND source = 'player'
    AND seller_type = 'player'
    AND seller_player_account_id IS NOT NULL
  );

-- Dono actualiza os seus (não pode virar store)
DROP POLICY IF EXISTS "Owners update own marketplace listings" ON marketplace_listings;
CREATE POLICY "Owners update own marketplace listings" ON marketplace_listings
  FOR UPDATE TO authenticated
  USING (auth.uid() = seller_user_id AND source = 'player')
  WITH CHECK (
    auth.uid() = seller_user_id
    AND source = 'player'
    AND seller_type = 'player'
  );

DROP POLICY IF EXISTS "Owners delete own marketplace listings" ON marketplace_listings;
CREATE POLICY "Owners delete own marketplace listings" ON marketplace_listings
  FOR DELETE TO authenticated
  USING (auth.uid() = seller_user_id AND source = 'player');

-- Store sync usa service_role (bypassa RLS). Grants para Data API:
GRANT SELECT, INSERT, UPDATE, DELETE ON marketplace_listings TO authenticated;
GRANT SELECT ON marketplace_listings TO anon;

-- ============================================
-- Storage bucket: marketplace-photos
-- Path: {auth.uid()}/{timestamp}.{ext}
-- ============================================

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'marketplace-photos',
  'marketplace-photos',
  true,
  5242880,
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif']
)
ON CONFLICT (id) DO UPDATE SET
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

DROP POLICY IF EXISTS "Public read marketplace photos" ON storage.objects;
CREATE POLICY "Public read marketplace photos" ON storage.objects
  FOR SELECT
  USING (bucket_id = 'marketplace-photos');

DROP POLICY IF EXISTS "Auth upload own marketplace photos" ON storage.objects;
CREATE POLICY "Auth upload own marketplace photos" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'marketplace-photos'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

DROP POLICY IF EXISTS "Auth update own marketplace photos" ON storage.objects;
CREATE POLICY "Auth update own marketplace photos" ON storage.objects
  FOR UPDATE TO authenticated
  USING (
    bucket_id = 'marketplace-photos'
    AND (storage.foldername(name))[1] = auth.uid()::text
  )
  WITH CHECK (
    bucket_id = 'marketplace-photos'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

DROP POLICY IF EXISTS "Auth delete own marketplace photos" ON storage.objects;
CREATE POLICY "Auth delete own marketplace photos" ON storage.objects
  FOR DELETE TO authenticated
  USING (
    bucket_id = 'marketplace-photos'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );
