-- ============================================================
-- GSW — FULL SCHEMA (run this once, in one paste)
-- Combines STORE_SCHEMA + CLOUD_SCHEMA + all migrations
-- Safe to re-run: uses IF NOT EXISTS / IF EXISTS throughout
-- ============================================================

-- ── 1. Customer tables ───────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT,
  phone TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name)
  VALUES (NEW.id, NEW.raw_user_meta_data->>'full_name')
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

CREATE TABLE IF NOT EXISTS carts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id)
);

CREATE TABLE IF NOT EXISTS cart_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cart_id UUID NOT NULL REFERENCES carts(id) ON DELETE CASCADE,
  item_id TEXT NOT NULL,
  name TEXT NOT NULL,
  sku TEXT,
  image_url TEXT,
  store_price NUMERIC NOT NULL DEFAULT 0,
  quantity INTEGER NOT NULL DEFAULT 1 CHECK (quantity > 0),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_number TEXT UNIQUE NOT NULL,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending','confirmed','ready','completed','cancelled','item_unavailable')),
  total NUMERIC NOT NULL DEFAULT 0,
  notes TEXT DEFAULT '',
  attention_note TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS order_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  item_id TEXT NOT NULL,
  name TEXT NOT NULL,
  sku TEXT,
  image_url TEXT,
  unit_price NUMERIC NOT NULL,
  quantity INTEGER NOT NULL DEFAULT 1 CHECK (quantity > 0)
);

CREATE INDEX IF NOT EXISTS idx_carts_user        ON carts(user_id);
CREATE INDEX IF NOT EXISTS idx_cart_items_cart   ON cart_items(cart_id);
CREATE INDEX IF NOT EXISTS idx_orders_user       ON orders(user_id);
CREATE INDEX IF NOT EXISTS idx_order_items_order ON order_items(order_id);

-- ── 2. Categories (must exist before inventory references it) ────────────────

CREATE TABLE IF NOT EXISTS categories (
  id          BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  name        TEXT NOT NULL UNIQUE,
  prefix      TEXT NOT NULL DEFAULT '',
  color       TEXT NOT NULL DEFAULT '#1e3a5f',
  sort_order  INTEGER NOT NULL DEFAULT 0,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- ── 3. Inventory ─────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS inventory (
  id            TEXT PRIMARY KEY,
  name          TEXT NOT NULL,
  category_id   BIGINT REFERENCES categories(id) ON DELETE SET NULL,
  category_name TEXT NOT NULL DEFAULT '',
  brand         TEXT DEFAULT '',
  model_number  TEXT DEFAULT '',
  voltage       TEXT DEFAULT '',
  sku           TEXT DEFAULT '',
  description   TEXT DEFAULT '',
  amount        INTEGER NOT NULL DEFAULT 0,
  store_price   NUMERIC NOT NULL DEFAULT 0,
  image_url     TEXT,
  images        TEXT[] NOT NULL DEFAULT '{}',
  featured      BOOLEAN NOT NULL DEFAULT FALSE,
  store_visible BOOLEAN NOT NULL DEFAULT TRUE,
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  updated_at    TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_inventory_category ON inventory(category_id);
CREATE INDEX IF NOT EXISTS idx_inventory_visible  ON inventory(store_visible);
CREATE INDEX IF NOT EXISTS idx_inventory_featured ON inventory(featured) WHERE featured = TRUE;

-- ── 4. Admin / staff roles ───────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS admin_users (
  user_id    UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  role       TEXT NOT NULL DEFAULT 'staff' CHECK (role IN ('owner','staff')),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- is_admin() — SECURITY DEFINER bypasses RLS (no recursion)
CREATE OR REPLACE FUNCTION is_admin()
RETURNS BOOLEAN AS $$
  SELECT EXISTS (SELECT 1 FROM admin_users WHERE user_id = auth.uid());
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- is_owner() — same pattern
CREATE OR REPLACE FUNCTION is_owner()
RETURNS BOOLEAN AS $$
  SELECT EXISTS (SELECT 1 FROM admin_users WHERE user_id = auth.uid() AND role = 'owner');
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- ── 5. updated_at trigger for inventory ──────────────────────────────────────

CREATE OR REPLACE FUNCTION touch_updated_at()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS inventory_touch ON inventory;
CREATE TRIGGER inventory_touch BEFORE UPDATE ON inventory
  FOR EACH ROW EXECUTE FUNCTION touch_updated_at();

-- ── 6. RLS ───────────────────────────────────────────────────────────────────

ALTER TABLE profiles    ENABLE ROW LEVEL SECURITY;
ALTER TABLE carts       ENABLE ROW LEVEL SECURITY;
ALTER TABLE cart_items  ENABLE ROW LEVEL SECURITY;
ALTER TABLE orders      ENABLE ROW LEVEL SECURITY;
ALTER TABLE order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE categories  ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventory   ENABLE ROW LEVEL SECURITY;
ALTER TABLE admin_users ENABLE ROW LEVEL SECURITY;

-- Customer tables
DROP POLICY IF EXISTS "profiles_own"    ON profiles;
CREATE POLICY "profiles_own"    ON profiles    FOR ALL USING (auth.uid() = id);
DROP POLICY IF EXISTS "carts_own"       ON carts;
CREATE POLICY "carts_own"       ON carts       FOR ALL USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "cart_items_own"  ON cart_items;
CREATE POLICY "cart_items_own"  ON cart_items  FOR ALL
  USING (cart_id IN (SELECT id FROM carts WHERE user_id = auth.uid()));
DROP POLICY IF EXISTS "orders_own"      ON orders;
CREATE POLICY "orders_own"      ON orders      FOR ALL USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "order_items_own" ON order_items;
CREATE POLICY "order_items_own" ON order_items FOR ALL
  USING (order_id IN (SELECT id FROM orders WHERE user_id = auth.uid()));

-- Staff read all orders / update status
DROP POLICY IF EXISTS orders_admin_read   ON orders;
CREATE POLICY orders_admin_read   ON orders      FOR SELECT USING (is_admin());
DROP POLICY IF EXISTS orders_admin_update ON orders;
CREATE POLICY orders_admin_update ON orders      FOR UPDATE USING (is_admin()) WITH CHECK (is_admin());
DROP POLICY IF EXISTS order_items_admin_read ON order_items;
CREATE POLICY order_items_admin_read ON order_items FOR SELECT USING (is_admin());

-- Categories: anyone reads, admins write
DROP POLICY IF EXISTS categories_read         ON categories;
CREATE POLICY categories_read         ON categories FOR SELECT USING (true);
DROP POLICY IF EXISTS categories_admin_write  ON categories;
CREATE POLICY categories_admin_write  ON categories FOR ALL USING (is_admin()) WITH CHECK (is_admin());

-- Inventory: visible items public; admins full access
DROP POLICY IF EXISTS inventory_read         ON inventory;
CREATE POLICY inventory_read         ON inventory FOR SELECT USING (store_visible OR is_admin());
DROP POLICY IF EXISTS inventory_admin_write  ON inventory;
CREATE POLICY inventory_admin_write  ON inventory FOR ALL USING (is_admin()) WITH CHECK (is_admin());

-- Admin users: self-read only (no is_admin() call here — avoids recursion)
DROP POLICY IF EXISTS admin_self_read   ON admin_users;
CREATE POLICY admin_self_read   ON admin_users FOR SELECT USING (user_id = auth.uid());
DROP POLICY IF EXISTS admin_owner_write ON admin_users;
CREATE POLICY admin_owner_write ON admin_users FOR ALL USING (is_owner()) WITH CHECK (is_owner());

-- ── 7. Realtime (idempotent) ─────────────────────────────────────────────────

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'orders'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE orders;
  END IF;
END $$;

-- ── 8. Seed categories ────────────────────────────────────────────────────────

INSERT INTO categories (name, prefix, color, sort_order) VALUES
  ('Power Tools', 'P', '#e74c3c', 1),
  ('Hand Tools',  'H', '#2980b9', 2),
  ('Measuring',   'M', '#27ae60', 3),
  ('Safety',      'S', '#f39c12', 4)
ON CONFLICT (name) DO NOTHING;

-- ============================================================
-- DONE. Next step:
--   Make yourself an admin — run this with YOUR email:
--
--   INSERT INTO admin_users (user_id, role)
--   SELECT id, 'owner' FROM auth.users WHERE email = 'YOUR_EMAIL';
-- ============================================================
