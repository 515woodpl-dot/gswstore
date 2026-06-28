-- ============================================================
-- GSW — Cloud-Only Schema (Phase 2: drop the Pi)
-- Run this AFTER STORE_SCHEMA.sql in Supabase SQL Editor.
-- Adds: inventory + categories tables (source of truth in Supabase),
--       admin roles, staff order access, and Realtime for alerts.
-- ============================================================

-- ── Categories ───────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS categories (
  id          BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  name        TEXT NOT NULL UNIQUE,
  prefix      TEXT NOT NULL DEFAULT '',          -- e.g. "P" for Power Tools → P001
  color       TEXT NOT NULL DEFAULT '#1e3a5f',
  sort_order  INTEGER NOT NULL DEFAULT 0,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- ── Inventory (the product catalog — source of truth) ────────────────────────
CREATE TABLE IF NOT EXISTS inventory (
  id            TEXT PRIMARY KEY,                 -- human id e.g. "P001"
  name          TEXT NOT NULL,
  category_id   BIGINT REFERENCES categories(id) ON DELETE SET NULL,
  category_name TEXT NOT NULL DEFAULT '',         -- denormalized for fast store reads
  brand         TEXT DEFAULT '',
  model_number  TEXT DEFAULT '',
  voltage       TEXT DEFAULT '',
  sku           TEXT DEFAULT '',
  description   TEXT DEFAULT '',
  amount        INTEGER NOT NULL DEFAULT 0,       -- stock count
  store_price   NUMERIC NOT NULL DEFAULT 0,
  image_url     TEXT,
  store_visible BOOLEAN NOT NULL DEFAULT TRUE,
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  updated_at    TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_inventory_category ON inventory(category_id);
CREATE INDEX IF NOT EXISTS idx_inventory_visible ON inventory(store_visible);

-- Stock status is derived (0 = out, 1-9 = low, 10+ = in) — computed in app code.

-- ── Admin / staff roles ──────────────────────────────────────────────────────
-- Anyone in this table can manage inventory and see ALL orders (for alerts + admin).
CREATE TABLE IF NOT EXISTS admin_users (
  user_id    UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  role       TEXT NOT NULL DEFAULT 'staff' CHECK (role IN ('owner','staff')),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Helper: is the current user an admin/staff member?
CREATE OR REPLACE FUNCTION is_admin()
RETURNS BOOLEAN AS $$
  SELECT EXISTS (SELECT 1 FROM admin_users WHERE user_id = auth.uid());
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- Helper: is the current user an owner? (SECURITY DEFINER bypasses RLS — no recursion)
CREATE OR REPLACE FUNCTION is_owner()
RETURNS BOOLEAN AS $$
  SELECT EXISTS (SELECT 1 FROM admin_users WHERE user_id = auth.uid() AND role = 'owner');
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- ── updated_at trigger for inventory ─────────────────────────────────────────
CREATE OR REPLACE FUNCTION touch_updated_at()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS inventory_touch ON inventory;
CREATE TRIGGER inventory_touch BEFORE UPDATE ON inventory
  FOR EACH ROW EXECUTE FUNCTION touch_updated_at();

-- ── RLS ──────────────────────────────────────────────────────────────────────
ALTER TABLE categories  ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventory   ENABLE ROW LEVEL SECURITY;
ALTER TABLE admin_users ENABLE ROW LEVEL SECURITY;

-- Categories: anyone can read; only admins can write
DROP POLICY IF EXISTS categories_read ON categories;
CREATE POLICY categories_read ON categories FOR SELECT USING (true);
DROP POLICY IF EXISTS categories_admin_write ON categories;
CREATE POLICY categories_admin_write ON categories FOR ALL USING (is_admin()) WITH CHECK (is_admin());

-- Inventory: anyone can read visible items; admins can read/write everything
DROP POLICY IF EXISTS inventory_read ON inventory;
CREATE POLICY inventory_read ON inventory FOR SELECT USING (store_visible OR is_admin());
DROP POLICY IF EXISTS inventory_admin_write ON inventory;
CREATE POLICY inventory_admin_write ON inventory FOR ALL USING (is_admin()) WITH CHECK (is_admin());

-- Admin_users: a user can see their own row; only owners can manage the list
-- Admin_users: a user can always read their own row (no is_admin() call here —
-- that would recurse, since is_admin() itself reads admin_users).
DROP POLICY IF EXISTS admin_self_read ON admin_users;
CREATE POLICY admin_self_read ON admin_users FOR SELECT
  USING (user_id = auth.uid());
DROP POLICY IF EXISTS admin_owner_write ON admin_users;
CREATE POLICY admin_owner_write ON admin_users FOR ALL
  USING (is_owner())
  WITH CHECK (is_owner());

-- ── Staff access to ALL orders (for the alerts screen + admin dashboard) ──────
-- The existing "orders_own" policy lets customers see their own orders.
-- Add a second policy so admins/staff can see every order.
DROP POLICY IF EXISTS orders_admin_read ON orders;
CREATE POLICY orders_admin_read ON orders FOR SELECT USING (is_admin());
DROP POLICY IF EXISTS orders_admin_update ON orders;
CREATE POLICY orders_admin_update ON orders FOR UPDATE USING (is_admin()) WITH CHECK (is_admin());

DROP POLICY IF EXISTS order_items_admin_read ON order_items;
CREATE POLICY order_items_admin_read ON order_items FOR SELECT USING (is_admin());

-- ── Realtime — broadcast order inserts/updates to the alerts app ─────────────
-- Adds the orders table to the realtime publication so alerts.goldenstonetools.com
-- receives live INSERT/UPDATE events over a websocket.
-- Idempotent: only adds if not already present (re-running this script is safe).
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'orders'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE orders;
  END IF;
END $$;

-- ── Seed: starter categories (safe to re-run) ────────────────────────────────
INSERT INTO categories (name, prefix, color, sort_order) VALUES
  ('Power Tools', 'P', '#e74c3c', 1),
  ('Hand Tools',  'H', '#2980b9', 2),
  ('Measuring',   'M', '#27ae60', 3),
  ('Safety',      'S', '#f39c12', 4)
ON CONFLICT (name) DO NOTHING;

-- ============================================================
-- AFTER RUNNING THIS:
--   1. Make yourself an admin (replace the email):
--      INSERT INTO admin_users (user_id, role)
--      SELECT id, 'owner' FROM auth.users WHERE email = 'you@example.com';
--   2. Confirm Realtime is on: Dashboard → Database → Replication →
--      ensure "orders" is in the supabase_realtime publication.
-- ============================================================

-- ── Featured + gallery (added later) ─────────────────────────────────────────
ALTER TABLE inventory ADD COLUMN IF NOT EXISTS featured BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE inventory ADD COLUMN IF NOT EXISTS images TEXT[] NOT NULL DEFAULT '{}';
CREATE INDEX IF NOT EXISTS idx_inventory_featured ON inventory(featured) WHERE featured = TRUE;
