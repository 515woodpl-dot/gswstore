-- ============================================================
-- GSW — MIGRATION: Sales documentation
-- Captures original vs. sold price, discounts, and who sold it.
-- Additive only. Safe to re-run.
-- ============================================================

-- ── order_items: capture list price + per-line discount ──────────────────────
-- unit_price already stores the ACTUAL price charged.
-- list_price stores the original catalog price so we can compute the discount.
ALTER TABLE order_items
  ADD COLUMN IF NOT EXISTS list_price      NUMERIC,          -- original catalog price
  ADD COLUMN IF NOT EXISTS discount_amount NUMERIC NOT NULL DEFAULT 0,  -- (list - unit) * qty
  ADD COLUMN IF NOT EXISTS discount_reason TEXT NOT NULL DEFAULT '';

-- Backfill list_price = unit_price for existing rows (no discount recorded).
UPDATE order_items SET list_price = unit_price WHERE list_price IS NULL;

-- ── orders: who made the sale + order-level discount notes ───────────────────
ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS sold_by_id     UUID REFERENCES auth.users(id),
  ADD COLUMN IF NOT EXISTS sold_by_name   TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS discount_total NUMERIC NOT NULL DEFAULT 0;

CREATE INDEX IF NOT EXISTS idx_orders_sold_by ON orders(sold_by_id);
CREATE INDEX IF NOT EXISTS idx_orders_created ON orders(created_at);

-- ============================================================
-- DONE.
-- Reporting example — total discounts by staff this month:
--   select sold_by_name, sum(discount_total) as discounts, count(*) as sales
--   from orders
--   where created_at >= date_trunc('month', now())
--   group by sold_by_name order by discounts desc;
-- ============================================================
