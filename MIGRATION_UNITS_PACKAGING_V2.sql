-- ============================================================
-- GSW - Units & Packaging review and transaction-safe math
-- Run once in Supabase after MIGRATION_INVENTORY_RECEIVING.sql.
-- Safe to re-run.
-- ============================================================

ALTER TABLE inventory ADD COLUMN IF NOT EXISTS base_unit TEXT NOT NULL DEFAULT 'Each';
ALTER TABLE inventory ADD COLUMN IF NOT EXISTS selling_unit TEXT NOT NULL DEFAULT 'Each';
ALTER TABLE inventory ADD COLUMN IF NOT EXISTS units_per_sale INTEGER NOT NULL DEFAULT 1 CHECK (units_per_sale > 0);
ALTER TABLE inventory ADD COLUMN IF NOT EXISTS packaging_reviewed BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE order_items ADD COLUMN IF NOT EXISTS base_units_per_sale INTEGER NOT NULL DEFAULT 1 CHECK (base_units_per_sale > 0);

UPDATE inventory
SET packaging_reviewed = TRUE
WHERE packaging_reviewed = FALSE
  AND (units_per_sale <> 1 OR base_unit <> 'Each' OR selling_unit <> 'Each');

-- Snapshot both cost per base unit and the sale conversion at order time.
CREATE OR REPLACE FUNCTION snapshot_order_item_cost()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_cost NUMERIC;
  v_units_per_sale INTEGER;
BEGIN
  SELECT cost_price, units_per_sale
  INTO v_cost, v_units_per_sale
  FROM inventory
  WHERE id = NEW.item_id;

  IF FOUND THEN
    NEW.cost_price := COALESCE(v_cost, 0);
    NEW.base_units_per_sale := GREATEST(COALESCE(v_units_per_sale, 1), 1);
  ELSE
    NEW.cost_price := COALESCE(NEW.cost_price, 0);
    NEW.base_units_per_sale := GREATEST(COALESCE(NEW.base_units_per_sale, 1), 1);
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS order_item_cost_snapshot ON order_items;
CREATE TRIGGER order_item_cost_snapshot
  BEFORE INSERT ON order_items
  FOR EACH ROW EXECUTE FUNCTION snapshot_order_item_cost();

-- Callers pass selling quantity. This function locks the row, converts once,
-- and refuses overselling instead of allowing negative base stock.
CREATE OR REPLACE FUNCTION decrement_packaged_inventory(p_item_id TEXT, p_selling_qty INTEGER)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_stock INTEGER;
  v_units_per_sale INTEGER;
  v_base_qty INTEGER;
BEGIN
  IF p_selling_qty IS NULL OR p_selling_qty <= 0 THEN
    RAISE EXCEPTION 'Sale quantity must be greater than zero.';
  END IF;

  SELECT amount, units_per_sale
  INTO v_stock, v_units_per_sale
  FROM inventory
  WHERE id = p_item_id
  FOR UPDATE;

  IF NOT FOUND THEN RAISE EXCEPTION 'Inventory item % does not exist.', p_item_id; END IF;
  v_base_qty := p_selling_qty * GREATEST(COALESCE(v_units_per_sale, 1), 1);
  IF v_stock < v_base_qty THEN
    RAISE EXCEPTION 'Not enough stock for %. Need % base units; % remain.', p_item_id, v_base_qty, v_stock;
  END IF;

  UPDATE inventory SET amount = amount - v_base_qty WHERE id = p_item_id;
END;
$$;

REVOKE ALL ON FUNCTION decrement_packaged_inventory(TEXT, INTEGER) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION decrement_packaged_inventory(TEXT, INTEGER) TO authenticated;

-- Confirm one product and repair only historical rows that still have the
-- untouched default conversion. Existing non-default snapshots are preserved.
CREATE OR REPLACE FUNCTION review_inventory_packaging(
  p_item_id TEXT,
  p_base_unit TEXT,
  p_selling_unit TEXT,
  p_units_per_sale INTEGER
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_factor INTEGER := GREATEST(COALESCE(p_units_per_sale, 1), 1);
BEGIN
  IF NOT is_admin() THEN RAISE EXCEPTION 'Only an admin can review packaging.'; END IF;
  IF NULLIF(TRIM(p_base_unit), '') IS NULL OR NULLIF(TRIM(p_selling_unit), '') IS NULL THEN
    RAISE EXCEPTION 'Base and selling units are required.';
  END IF;

  UPDATE inventory
  SET base_unit = TRIM(p_base_unit),
      selling_unit = TRIM(p_selling_unit),
      units_per_sale = v_factor,
      packaging_reviewed = TRUE
  WHERE id = p_item_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Inventory item % does not exist.', p_item_id; END IF;

  UPDATE order_items
  SET base_units_per_sale = v_factor
  WHERE item_id = p_item_id AND base_units_per_sale = 1;
END;
$$;

REVOKE ALL ON FUNCTION review_inventory_packaging(TEXT, TEXT, TEXT, INTEGER) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION review_inventory_packaging(TEXT, TEXT, TEXT, INTEGER) TO authenticated;

UPDATE order_items oi
SET base_units_per_sale = inv.units_per_sale
FROM inventory inv
WHERE oi.item_id = inv.id
  AND oi.base_units_per_sale = 1
  AND inv.packaging_reviewed = TRUE;
