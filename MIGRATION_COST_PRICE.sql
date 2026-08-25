-- ============================================================
-- GSW — MIGRATION: Cost price (what you paid for each item)
-- Enables profit tracking in the sales report.
-- Additive only. Safe to re-run.
-- ============================================================

-- Inventory: what you pay for each item
ALTER TABLE inventory
  ADD COLUMN IF NOT EXISTS cost_price NUMERIC NOT NULL DEFAULT 0;

-- Order items: snapshot cost at time of sale (so profit calc stays
-- accurate even if you update the cost later)
ALTER TABLE order_items
  ADD COLUMN IF NOT EXISTS cost_price NUMERIC NOT NULL DEFAULT 0;

-- Backfill: set order_items.cost_price from inventory for existing sales.
-- (Best effort — items that no longer exist get 0.)
UPDATE order_items oi
  SET cost_price = COALESCE(inv.cost_price, 0)
  FROM inventory inv
  WHERE oi.item_id = inv.id
    AND oi.cost_price = 0;

-- ============================================================
-- DONE.
-- Profit per item = (unit_price - cost_price) * quantity
-- ============================================================
