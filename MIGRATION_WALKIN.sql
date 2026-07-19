-- ============================================================
-- GSW — MIGRATION: Walk-in checkout (POS)
-- Additive only. Safe to re-run.
-- ============================================================

-- Walk-in customers, deduped by email for marketing/purchase history
CREATE TABLE IF NOT EXISTS walk_in_customers (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name       TEXT NOT NULL DEFAULT '',
  email      TEXT NOT NULL UNIQUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Link orders to a walk-in customer + mark the order source
ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS walk_in_customer_id UUID REFERENCES walk_in_customers(id),
  ADD COLUMN IF NOT EXISTS source TEXT NOT NULL DEFAULT 'online';  -- 'online' | 'walk_in'

-- Allow orders.user_id to be null for walk-in sales (no account needed)
ALTER TABLE orders ALTER COLUMN user_id DROP NOT NULL;

CREATE INDEX IF NOT EXISTS idx_orders_walkin ON orders(walk_in_customer_id);
CREATE INDEX IF NOT EXISTS idx_walkin_email ON walk_in_customers(email);

-- RLS: staff/admin only
ALTER TABLE walk_in_customers ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS walkin_admin_all ON walk_in_customers;
CREATE POLICY walkin_admin_all ON walk_in_customers
  FOR ALL USING (is_admin()) WITH CHECK (is_admin());

-- ============================================================
-- DONE. Purchase history per customer:
--   select o.* from orders o
--   join walk_in_customers w on w.id = o.walk_in_customer_id
--   where w.email = 'customer@email.com';
-- ============================================================
