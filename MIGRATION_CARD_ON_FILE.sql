-- ============================================================
-- GSW — MIGRATION: Card on file (Square customer ID)
-- Additive only. Safe to re-run.
-- ============================================================

-- Store the Square Customer ID per user so we can create/retrieve
-- saved cards via the Square Cards API.
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS square_customer_id TEXT;

CREATE INDEX IF NOT EXISTS idx_profiles_square_customer ON profiles(square_customer_id)
  WHERE square_customer_id IS NOT NULL;

-- saved_cards: mirrors the Square Card object for display purposes only.
-- The actual card data lives in Square — we only store non-sensitive metadata.
CREATE TABLE IF NOT EXISTS saved_cards (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  square_card_id  TEXT NOT NULL UNIQUE,  -- Square's card ID (starts with "ccof:")
  brand           TEXT NOT NULL DEFAULT '',
  last_4          TEXT NOT NULL DEFAULT '',
  exp_month       INTEGER NOT NULL DEFAULT 0,
  exp_year        INTEGER NOT NULL DEFAULT 0,
  cardholder_name TEXT NOT NULL DEFAULT '',
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_saved_cards_user ON saved_cards(user_id);

ALTER TABLE saved_cards ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS saved_cards_own ON saved_cards;
CREATE POLICY saved_cards_own ON saved_cards
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS saved_cards_admin ON saved_cards;
CREATE POLICY saved_cards_admin ON saved_cards
  FOR ALL USING (is_admin()) WITH CHECK (is_admin());

-- ============================================================
-- DONE.
-- ============================================================
