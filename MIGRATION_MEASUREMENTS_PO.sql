-- ═══════════════════════════════════════════════════════════════════════════════
-- MIGRATION: Measurements fields + Purchase Orders system
-- Run in Supabase SQL Editor
-- ═══════════════════════════════════════════════════════════════════════════════

-- ── 1. Add measurement columns to inventory ──────────────────────────────────
ALTER TABLE inventory ADD COLUMN IF NOT EXISTS dimensions TEXT DEFAULT '';
ALTER TABLE inventory ADD COLUMN IF NOT EXISTS weight TEXT DEFAULT '';
ALTER TABLE inventory ADD COLUMN IF NOT EXISTS material TEXT DEFAULT '';

-- ── 2. Suppliers table ───────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS suppliers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  contact_name TEXT DEFAULT '',
  email TEXT DEFAULT '',
  phone TEXT DEFAULT '',
  notes TEXT DEFAULT '',
  created_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE suppliers ENABLE ROW LEVEL SECURITY;
CREATE POLICY suppliers_admin_all ON suppliers FOR ALL USING (is_admin());

-- ── 3. Purchase Orders table ─────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS purchase_orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  po_number TEXT NOT NULL UNIQUE,
  supplier_id UUID REFERENCES suppliers(id) ON DELETE SET NULL,
  supplier_name TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','ordered','received','cancelled')),
  -- Extra costs
  freight NUMERIC NOT NULL DEFAULT 0,
  tariffs NUMERIC NOT NULL DEFAULT 0,
  handling NUMERIC NOT NULL DEFAULT 0,
  -- Totals (computed on receive)
  subtotal NUMERIC NOT NULL DEFAULT 0,
  landed_total NUMERIC NOT NULL DEFAULT 0,
  notes TEXT DEFAULT '',
  ordered_at TIMESTAMPTZ,
  received_at TIMESTAMPTZ,
  received_by TEXT DEFAULT '',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE purchase_orders ENABLE ROW LEVEL SECURITY;
CREATE POLICY po_admin_all ON purchase_orders FOR ALL USING (is_admin());

-- ── 4. PO line items ─────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS po_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  po_id UUID NOT NULL REFERENCES purchase_orders(id) ON DELETE CASCADE,
  item_id UUID REFERENCES inventory(id) ON DELETE SET NULL,
  item_name TEXT NOT NULL DEFAULT '',
  quantity INTEGER NOT NULL DEFAULT 1,
  unit_cost NUMERIC NOT NULL DEFAULT 0,       -- price you paid per unit (before extras)
  landed_cost NUMERIC NOT NULL DEFAULT 0,     -- final per-unit cost after allocation
  created_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE po_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY po_items_admin_all ON po_items FOR ALL USING (is_admin());

-- ── 5. Index for fast PO lookups ─────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_po_items_po_id ON po_items(po_id);
CREATE INDEX IF NOT EXISTS idx_po_status ON purchase_orders(status);
