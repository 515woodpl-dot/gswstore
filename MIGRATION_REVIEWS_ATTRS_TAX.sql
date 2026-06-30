-- ============================================================
-- GSW — MIGRATION: Reviews + Key Attributes + Tax
-- Additive only. Safe to re-run (IF NOT EXISTS / IF EXISTS).
-- Run this once in the Supabase SQL editor.
-- ============================================================

-- ── 1. Inventory: Key Attributes + Tax columns ───────────────────────────────
-- attributes: flexible key→value pairs shown in the "Key attributes" block.
--   e.g. {"Material":"Steel","Installation":"Freestanding","Surface Finishing":"Chrome"}
-- tax_enabled / tax_rate_percent: per-item tax control from the admin panel.
ALTER TABLE inventory
  ADD COLUMN IF NOT EXISTS attributes        JSONB   NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS tax_enabled       BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS tax_rate_percent  NUMERIC NOT NULL DEFAULT 0;

-- ── 2. Reviews table ─────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS reviews (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  item_id     TEXT NOT NULL REFERENCES inventory(id) ON DELETE CASCADE,
  user_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  author_name TEXT NOT NULL DEFAULT '',
  rating      INTEGER NOT NULL CHECK (rating BETWEEN 1 AND 5),
  title       TEXT NOT NULL DEFAULT '',
  body        TEXT NOT NULL DEFAULT '',
  approved    BOOLEAN NOT NULL DEFAULT TRUE,
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  -- one review per customer per product (re-submitting updates the row)
  UNIQUE (item_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_reviews_item ON reviews(item_id);
CREATE INDEX IF NOT EXISTS idx_reviews_user ON reviews(user_id);

-- ── 3. RLS for reviews ───────────────────────────────────────────────────────
ALTER TABLE reviews ENABLE ROW LEVEL SECURITY;

-- Anyone can read approved reviews; admins read all; authors read their own.
DROP POLICY IF EXISTS reviews_read ON reviews;
CREATE POLICY reviews_read ON reviews
  FOR SELECT USING (approved OR is_admin() OR auth.uid() = user_id);

-- Logged-in customers can create their own review.
DROP POLICY IF EXISTS reviews_insert_own ON reviews;
CREATE POLICY reviews_insert_own ON reviews
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Customers can edit/delete their own review.
DROP POLICY IF EXISTS reviews_update_own ON reviews;
CREATE POLICY reviews_update_own ON reviews
  FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS reviews_delete_own ON reviews;
CREATE POLICY reviews_delete_own ON reviews
  FOR DELETE USING (auth.uid() = user_id);

-- Admins can moderate (update approved flag / delete any review).
DROP POLICY IF EXISTS reviews_admin_all ON reviews;
CREATE POLICY reviews_admin_all ON reviews
  FOR ALL USING (is_admin()) WITH CHECK (is_admin());

-- ============================================================
-- DONE.
-- Reviews are auto-approved (approved=TRUE by default). To switch to
-- moderation, change the DEFAULT above to FALSE and approve in the admin panel.
-- ============================================================
