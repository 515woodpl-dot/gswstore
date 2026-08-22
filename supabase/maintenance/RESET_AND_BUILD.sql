-- ============================================================
-- GSW — RESET & BUILD (use this if you hit the category_id error)
-- Drops the inventory-side tables (which may be half-built) and
-- rebuilds everything cleanly. SAFE while setting up — there is
-- no real product/order data yet.
--
-- NOTE: this drops inventory, categories, admin_users, and the
-- order/cart tables too, so it's a clean slate. Run the whole thing.
-- ============================================================

-- Drop in dependency order (children first)
DROP TABLE IF EXISTS order_items CASCADE;
DROP TABLE IF EXISTS orders       CASCADE;
DROP TABLE IF EXISTS cart_items   CASCADE;
DROP TABLE IF EXISTS carts        CASCADE;
DROP TABLE IF EXISTS inventory    CASCADE;
DROP TABLE IF EXISTS categories   CASCADE;
DROP TABLE IF EXISTS admin_users  CASCADE;
DROP TABLE IF EXISTS profiles     CASCADE;

-- ── Now rebuild everything in the correct order ──────────────────────────────

CREATE TABLE profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT, phone TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(), updated_at TIMESTAMPTZ DEFAULT NOW()
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
  AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION handle_new_user();

CREATE TABLE carts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(), updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id)
);

CREATE TABLE cart_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cart_id UUID NOT NULL REFERENCES carts(id) ON DELETE CASCADE,
  item_id TEXT NOT NULL, name TEXT NOT NULL, sku TEXT, image_url TEXT,
  store_price NUMERIC NOT NULL DEFAULT 0,
  quantity INTEGER NOT NULL DEFAULT 1 CHECK (quantity > 0),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_number TEXT UNIQUE NOT NULL,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending','confirmed','ready','completed','cancelled','item_unavailable')),
  total NUMERIC NOT NULL DEFAULT 0,
  notes TEXT DEFAULT '', attention_note TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ DEFAULT NOW(), updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE order_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  item_id TEXT NOT NULL, name TEXT NOT NULL, sku TEXT, image_url TEXT,
  unit_price NUMERIC NOT NULL,
  quantity INTEGER NOT NULL DEFAULT 1 CHECK (quantity > 0)
);

CREATE TABLE categories (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  name TEXT NOT NULL UNIQUE, prefix TEXT NOT NULL DEFAULT '',
  color TEXT NOT NULL DEFAULT '#1e3a5f', sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE inventory (
  id TEXT PRIMARY KEY, name TEXT NOT NULL,
  category_id BIGINT REFERENCES categories(id) ON DELETE SET NULL,
  category_name TEXT NOT NULL DEFAULT '',
  brand TEXT DEFAULT '', model_number TEXT DEFAULT '', voltage TEXT DEFAULT '',
  sku TEXT DEFAULT '', description TEXT DEFAULT '',
  amount INTEGER NOT NULL DEFAULT 0, store_price NUMERIC NOT NULL DEFAULT 0,
  image_url TEXT, images TEXT[] NOT NULL DEFAULT '{}',
  featured BOOLEAN NOT NULL DEFAULT FALSE, store_visible BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(), updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE admin_users (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  role TEXT NOT NULL DEFAULT 'staff' CHECK (role IN ('owner','staff')),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_carts_user        ON carts(user_id);
CREATE INDEX idx_cart_items_cart   ON cart_items(cart_id);
CREATE INDEX idx_orders_user       ON orders(user_id);
CREATE INDEX idx_order_items_order ON order_items(order_id);
CREATE INDEX idx_inventory_category ON inventory(category_id);
CREATE INDEX idx_inventory_visible  ON inventory(store_visible);
CREATE INDEX idx_inventory_featured ON inventory(featured) WHERE featured = TRUE;

CREATE OR REPLACE FUNCTION is_admin()
RETURNS BOOLEAN AS $$ SELECT EXISTS (SELECT 1 FROM admin_users WHERE user_id = auth.uid()); $$
LANGUAGE sql SECURITY DEFINER STABLE;

CREATE OR REPLACE FUNCTION is_owner()
RETURNS BOOLEAN AS $$ SELECT EXISTS (SELECT 1 FROM admin_users WHERE user_id = auth.uid() AND role = 'owner'); $$
LANGUAGE sql SECURITY DEFINER STABLE;

CREATE OR REPLACE FUNCTION touch_updated_at()
RETURNS TRIGGER AS $$ BEGIN NEW.updated_at = NOW(); RETURN NEW; END; $$ LANGUAGE plpgsql;
CREATE TRIGGER inventory_touch BEFORE UPDATE ON inventory
  FOR EACH ROW EXECUTE FUNCTION touch_updated_at();

ALTER TABLE profiles    ENABLE ROW LEVEL SECURITY;
ALTER TABLE carts       ENABLE ROW LEVEL SECURITY;
ALTER TABLE cart_items  ENABLE ROW LEVEL SECURITY;
ALTER TABLE orders      ENABLE ROW LEVEL SECURITY;
ALTER TABLE order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE categories  ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventory   ENABLE ROW LEVEL SECURITY;
ALTER TABLE admin_users ENABLE ROW LEVEL SECURITY;

CREATE POLICY "profiles_own"    ON profiles    FOR ALL USING (auth.uid() = id);
CREATE POLICY "carts_own"       ON carts       FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "cart_items_own"  ON cart_items  FOR ALL
  USING (cart_id IN (SELECT id FROM carts WHERE user_id = auth.uid()));
CREATE POLICY "orders_own"      ON orders      FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "order_items_own" ON order_items FOR ALL
  USING (order_id IN (SELECT id FROM orders WHERE user_id = auth.uid()));
CREATE POLICY orders_admin_read    ON orders      FOR SELECT USING (is_admin());
CREATE POLICY orders_admin_update  ON orders      FOR UPDATE USING (is_admin()) WITH CHECK (is_admin());
CREATE POLICY order_items_admin_read ON order_items FOR SELECT USING (is_admin());
CREATE POLICY categories_read        ON categories FOR SELECT USING (true);
CREATE POLICY categories_admin_write ON categories FOR ALL USING (is_admin()) WITH CHECK (is_admin());
CREATE POLICY inventory_read         ON inventory FOR SELECT USING (store_visible OR is_admin());
CREATE POLICY inventory_admin_write  ON inventory FOR ALL USING (is_admin()) WITH CHECK (is_admin());
CREATE POLICY admin_self_read   ON admin_users FOR SELECT USING (user_id = auth.uid());
CREATE POLICY admin_owner_write ON admin_users FOR ALL USING (is_owner()) WITH CHECK (is_owner());

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'orders') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE orders;
  END IF;
END $$;

INSERT INTO categories (name, prefix, color, sort_order) VALUES
  ('Power Tools', 'P', '#e74c3c', 1), ('Hand Tools', 'H', '#2980b9', 2),
  ('Measuring', 'M', '#27ae60', 3),  ('Safety', 'S', '#f39c12', 4)
ON CONFLICT (name) DO NOTHING;

-- DONE. Then make yourself admin:
--   INSERT INTO admin_users (user_id, role)
--   SELECT id, 'owner' FROM auth.users WHERE email = 'YOUR_EMAIL';
