-- ============================================================
-- GSW - Inventory receiving batches and landed cost allocation
-- Run this entire file in the Supabase SQL Editor.
-- Additive and safe to re-run.
-- ============================================================

ALTER TABLE inventory
  ADD COLUMN IF NOT EXISTS cost_price NUMERIC NOT NULL DEFAULT 0;

ALTER TABLE inventory
  ADD COLUMN IF NOT EXISTS original_name TEXT NOT NULL DEFAULT '';

ALTER TABLE order_items
  ADD COLUMN IF NOT EXISTS base_units_per_sale INTEGER NOT NULL DEFAULT 1;

ALTER TABLE inventory
  ADD COLUMN IF NOT EXISTS base_unit TEXT NOT NULL DEFAULT 'Each',
  ADD COLUMN IF NOT EXISTS selling_unit TEXT NOT NULL DEFAULT 'Each',
  ADD COLUMN IF NOT EXISTS units_per_sale INTEGER NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS packaging_reviewed BOOLEAN NOT NULL DEFAULT FALSE;

-- Existing products start with their current name as the best-known original.
-- Staff can replace this with the supplier's exact name in Products.
UPDATE inventory
SET original_name = name
WHERE NULLIF(TRIM(original_name), '') IS NULL;

ALTER TABLE order_items
  ADD COLUMN IF NOT EXISTS cost_price NUMERIC NOT NULL DEFAULT 0;

CREATE TABLE IF NOT EXISTS inventory_receipts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  receipt_code TEXT NOT NULL UNIQUE,
  supplier_name TEXT NOT NULL DEFAULT '',
  supplier_invoice TEXT NOT NULL DEFAULT '',
  received_date DATE NOT NULL DEFAULT CURRENT_DATE,
  notes TEXT NOT NULL DEFAULT '',
  allocation_mode TEXT NOT NULL DEFAULT 'automatic'
    CHECK (allocation_mode IN ('automatic', 'manual')),
  item_subtotal NUMERIC NOT NULL DEFAULT 0 CHECK (item_subtotal >= 0),
  shared_expenses NUMERIC NOT NULL DEFAULT 0 CHECK (shared_expenses >= 0),
  landed_total NUMERIC NOT NULL DEFAULT 0 CHECK (landed_total >= 0),
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL DEFAULT auth.uid(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS inventory_receipt_expenses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  receipt_id UUID NOT NULL REFERENCES inventory_receipts(id) ON DELETE CASCADE,
  expense_type TEXT NOT NULL
    CHECK (expense_type IN ('freight', 'tariff', 'tax', 'handling', 'other')),
  label TEXT NOT NULL DEFAULT '',
  amount NUMERIC NOT NULL DEFAULT 0 CHECK (amount >= 0),
  allocation_method TEXT NOT NULL
    CHECK (allocation_method IN ('value', 'quantity', 'weight', 'manual')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS inventory_receipt_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  receipt_id UUID NOT NULL REFERENCES inventory_receipts(id) ON DELETE CASCADE,
  inventory_id TEXT NOT NULL REFERENCES inventory(id) ON UPDATE CASCADE ON DELETE RESTRICT,
  original_name_snapshot TEXT NOT NULL DEFAULT '',
  quantity_received INTEGER NOT NULL CHECK (quantity_received > 0),
  supplier_unit_cost NUMERIC NOT NULL CHECK (supplier_unit_cost >= 0),
  unit_weight NUMERIC NOT NULL DEFAULT 0 CHECK (unit_weight >= 0),
  allocated_expense NUMERIC NOT NULL DEFAULT 0 CHECK (allocated_expense >= 0),
  landed_unit_cost NUMERIC NOT NULL DEFAULT 0 CHECK (landed_unit_cost >= 0),
  previous_quantity INTEGER NOT NULL DEFAULT 0,
  previous_average_cost NUMERIC NOT NULL DEFAULT 0,
  new_average_cost NUMERIC NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (receipt_id, inventory_id)
);

ALTER TABLE inventory_receipt_items
  ADD COLUMN IF NOT EXISTS original_name_snapshot TEXT NOT NULL DEFAULT '';

-- Existing receipts have no reliable per-batch remaining quantity history, so
-- corrections apply only to receipts created after this version is installed.
ALTER TABLE inventory_receipt_items
  ADD COLUMN IF NOT EXISTS remaining_quantity INTEGER NOT NULL DEFAULT 0
    CHECK (remaining_quantity >= 0);

ALTER TABLE inventory_receipt_items
  ADD COLUMN IF NOT EXISTS purchase_unit TEXT NOT NULL DEFAULT 'Each',
  ADD COLUMN IF NOT EXISTS base_units_per_purchase INTEGER NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS purchase_quantity_received INTEGER NOT NULL DEFAULT 0;

CREATE INDEX IF NOT EXISTS idx_inventory_receipts_date
  ON inventory_receipts(received_date DESC, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_inventory_receipt_items_receipt
  ON inventory_receipt_items(receipt_id);
CREATE INDEX IF NOT EXISTS idx_inventory_receipt_items_inventory
  ON inventory_receipt_items(inventory_id);
CREATE INDEX IF NOT EXISTS idx_inventory_receipt_expenses_receipt
  ON inventory_receipt_expenses(receipt_id);

ALTER TABLE inventory_receipts ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventory_receipt_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventory_receipt_expenses ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS inventory_receipts_admin_all ON inventory_receipts;
CREATE POLICY inventory_receipts_admin_all ON inventory_receipts
  FOR ALL USING (is_admin()) WITH CHECK (is_admin());

DROP POLICY IF EXISTS inventory_receipt_items_admin_all ON inventory_receipt_items;
CREATE POLICY inventory_receipt_items_admin_all ON inventory_receipt_items
  FOR ALL USING (is_admin()) WITH CHECK (is_admin());

DROP POLICY IF EXISTS inventory_receipt_expenses_admin_all ON inventory_receipt_expenses;
CREATE POLICY inventory_receipt_expenses_admin_all ON inventory_receipt_expenses
  FOR ALL USING (is_admin()) WITH CHECK (is_admin());

GRANT SELECT, INSERT, UPDATE, DELETE ON inventory_receipts TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON inventory_receipt_items TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON inventory_receipt_expenses TO authenticated;

-- Always capture the current catalog cost when a catalog item is sold.
-- This applies to online, walk-in, and manual sales and preserves history.
CREATE OR REPLACE FUNCTION snapshot_order_item_cost()
RETURNS TRIGGER AS $$
DECLARE
  v_cost NUMERIC;
  v_units_per_sale INTEGER;
BEGIN
  SELECT cost_price, units_per_sale INTO v_cost, v_units_per_sale
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
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS order_item_cost_snapshot ON order_items;
CREATE TRIGGER order_item_cost_snapshot
  BEFORE INSERT ON order_items
  FOR EACH ROW EXECUTE FUNCTION snapshot_order_item_cost();

-- Receive a whole supplier shipment in one transaction. Shared costs are
-- allocated by value, quantity, or weight and inventory gets a weighted-average
-- cost. If any validation fails, the entire receipt is rolled back.
CREATE OR REPLACE FUNCTION receive_inventory_batch(
  p_receipt_code TEXT,
  p_supplier_name TEXT,
  p_supplier_invoice TEXT,
  p_received_date DATE,
  p_notes TEXT,
  p_allocation_mode TEXT,
  p_expenses JSONB,
  p_items JSONB
)
RETURNS TABLE(batch_id UUID, batch_code TEXT)
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_batch_id UUID;
  v_batch_code TEXT;
  v_received_date DATE := COALESCE(p_received_date, CURRENT_DATE);
  v_mode TEXT := COALESCE(NULLIF(p_allocation_mode, ''), 'automatic');
  v_item JSONB;
  v_expense JSONB;
  v_inventory_id TEXT;
  v_quantity INTEGER;
  v_supplier_cost NUMERIC;
  v_unit_weight NUMERIC;
  v_manual_allocation NUMERIC;
  v_purchase_unit TEXT;
  v_base_units_per_purchase INTEGER;
  v_purchase_quantity INTEGER;
  v_previous_quantity INTEGER;
  v_previous_cost NUMERIC;
  v_original_name TEXT;
  v_new_product JSONB;
  v_new_name TEXT;
  v_new_original_name TEXT;
  v_new_sku TEXT;
  v_new_category_id BIGINT;
  v_new_category_name TEXT;
  v_new_store_price NUMERIC;
  v_new_store_visible BOOLEAN;
  v_new_selling_unit TEXT;
  v_new_base_unit TEXT;
  v_new_units_per_sale INTEGER;
  v_expense_type TEXT;
  v_expense_amount NUMERIC;
  v_expense_method TEXT;
  v_total_quantity NUMERIC;
  v_total_value NUMERIC;
  v_total_weight NUMERIC;
  v_weighted_line_count INTEGER;
  v_line_count INTEGER;
  v_item_subtotal NUMERIC;
  v_expense_total NUMERIC;
  v_manual_total NUMERIC;
  v_allocation_delta NUMERIC;
BEGIN
  IF NOT is_admin() THEN
    RAISE EXCEPTION 'Only an admin can receive inventory.';
  END IF;
  IF v_mode NOT IN ('automatic', 'manual') THEN
    RAISE EXCEPTION 'Allocation mode must be automatic or manual.';
  END IF;
  IF NULLIF(TRIM(p_supplier_name), '') IS NULL THEN
    RAISE EXCEPTION 'A supplier name is required.';
  END IF;
  IF p_items IS NULL OR jsonb_typeof(p_items) <> 'array' OR jsonb_array_length(p_items) = 0 THEN
    RAISE EXCEPTION 'Add at least one inventory item to the receipt.';
  END IF;
  IF p_expenses IS NOT NULL AND jsonb_typeof(p_expenses) <> 'array' THEN
    RAISE EXCEPTION 'Expenses must be an array.';
  END IF;

  v_batch_code := UPPER(COALESCE(NULLIF(TRIM(p_receipt_code), ''),
    'RCV-' || TO_CHAR(v_received_date, 'YYYYMMDD') || '-' ||
    UPPER(SUBSTRING(REPLACE(gen_random_uuid()::TEXT, '-', '') FROM 1 FOR 6))));

  INSERT INTO inventory_receipts (
    receipt_code, supplier_name, supplier_invoice, received_date, notes,
    allocation_mode, created_by
  ) VALUES (
    v_batch_code, COALESCE(TRIM(p_supplier_name), ''),
    COALESCE(TRIM(p_supplier_invoice), ''), v_received_date,
    COALESCE(TRIM(p_notes), ''), v_mode, auth.uid()
  ) RETURNING id INTO v_batch_id;

  FOR v_item IN SELECT value FROM jsonb_array_elements(p_items)
  LOOP
    v_inventory_id := NULLIF(TRIM(v_item->>'inventory_id'), '');
    v_quantity := COALESCE(NULLIF(v_item->>'quantity', '')::INTEGER, 0);
    v_supplier_cost := COALESCE(NULLIF(v_item->>'supplier_unit_cost', '')::NUMERIC, 0);
    v_unit_weight := COALESCE(NULLIF(v_item->>'unit_weight', '')::NUMERIC, 0);
    v_manual_allocation := COALESCE(NULLIF(v_item->>'manual_allocated_expense', '')::NUMERIC, 0);
    v_purchase_unit := COALESCE(NULLIF(TRIM(v_item->>'purchase_unit'), ''), 'Each');
    v_base_units_per_purchase := GREATEST(COALESCE(NULLIF(v_item->>'base_units_per_purchase', '')::INTEGER, 1), 1);
    v_purchase_quantity := GREATEST(COALESCE(NULLIF(v_item->>'purchase_quantity', '')::INTEGER, v_quantity / v_base_units_per_purchase), 0);

    IF v_inventory_id IS NULL THEN RAISE EXCEPTION 'Every receipt line needs an inventory item.'; END IF;
    IF v_quantity <= 0 THEN RAISE EXCEPTION 'Quantity for item % must be greater than zero.', v_inventory_id; END IF;
    IF v_supplier_cost < 0 THEN RAISE EXCEPTION 'Supplier cost for item % cannot be negative.', v_inventory_id; END IF;
    IF v_unit_weight < 0 THEN RAISE EXCEPTION 'Weight for item % cannot be negative.', v_inventory_id; END IF;
    IF v_manual_allocation < 0 THEN RAISE EXCEPTION 'Manual allocation for item % cannot be negative.', v_inventory_id; END IF;

    SELECT amount, cost_price, COALESCE(NULLIF(TRIM(original_name), ''), name)
      INTO v_previous_quantity, v_previous_cost, v_original_name
    FROM inventory
    WHERE id = v_inventory_id
    FOR UPDATE;

    IF NOT FOUND THEN
      v_new_product := v_item->'new_product';
      IF v_new_product IS NULL OR jsonb_typeof(v_new_product) <> 'object' THEN
        RAISE EXCEPTION 'Inventory item % does not exist.', v_inventory_id;
      END IF;

      v_new_name := NULLIF(TRIM(v_new_product->>'name'), '');
      v_new_original_name := COALESCE(NULLIF(TRIM(v_new_product->>'original_name'), ''), v_new_name);
      v_new_sku := COALESCE(NULLIF(UPPER(TRIM(v_new_product->>'sku')), ''), v_inventory_id);
      v_new_category_id := NULLIF(v_new_product->>'category_id', '')::BIGINT;
      v_new_store_price := COALESCE(NULLIF(v_new_product->>'store_price', '')::NUMERIC, 0);
      v_new_store_visible := COALESCE(NULLIF(v_new_product->>'store_visible', '')::BOOLEAN, FALSE);
      v_new_selling_unit := COALESCE(NULLIF(TRIM(v_new_product->>'selling_unit'), ''), 'Each');
      v_new_base_unit := COALESCE(NULLIF(TRIM(v_new_product->>'base_unit'), ''), 'Each');
      v_new_units_per_sale := GREATEST(COALESCE(NULLIF(v_new_product->>'units_per_sale', '')::INTEGER, 1), 1);

      IF v_new_name IS NULL THEN RAISE EXCEPTION 'A new store name is required for item %.', v_inventory_id; END IF;
      IF v_new_original_name IS NULL THEN RAISE EXCEPTION 'An original supplier name is required for item %.', v_inventory_id; END IF;
      IF v_new_category_id IS NULL THEN RAISE EXCEPTION 'A category is required for new item %.', v_inventory_id; END IF;
      IF v_new_store_price < 0 THEN RAISE EXCEPTION 'Selling price for item % cannot be negative.', v_inventory_id; END IF;

      SELECT name INTO v_new_category_name
      FROM categories
      WHERE id = v_new_category_id;
      IF NOT FOUND THEN RAISE EXCEPTION 'Category % does not exist.', v_new_category_id; END IF;

      INSERT INTO inventory (
        id, name, original_name, category_id, category_name, sku,
        amount, store_price, cost_price, store_visible, base_unit, selling_unit, units_per_sale, packaging_reviewed
      ) VALUES (
        v_inventory_id, v_new_name, v_new_original_name,
        v_new_category_id, v_new_category_name, v_new_sku,
        0, v_new_store_price, 0, v_new_store_visible, v_new_base_unit, v_new_selling_unit, v_new_units_per_sale, TRUE
      );

      v_previous_quantity := 0;
      v_previous_cost := 0;
      v_original_name := v_new_original_name;
    END IF;

    INSERT INTO inventory_receipt_items (
      receipt_id, inventory_id, original_name_snapshot, quantity_received, supplier_unit_cost,
      unit_weight, allocated_expense, previous_quantity, previous_average_cost, remaining_quantity,
      purchase_unit, base_units_per_purchase, purchase_quantity_received
    ) VALUES (
      v_batch_id, v_inventory_id, v_original_name, v_quantity, v_supplier_cost,
      v_unit_weight, CASE WHEN v_mode = 'manual' THEN v_manual_allocation ELSE 0 END,
      v_previous_quantity, COALESCE(v_previous_cost, 0), v_quantity,
      v_purchase_unit, v_base_units_per_purchase, v_purchase_quantity
    );
  END LOOP;

  SELECT COUNT(*), COALESCE(SUM(quantity_received), 0),
    COALESCE(SUM(quantity_received * supplier_unit_cost), 0),
    COALESCE(SUM(quantity_received * unit_weight), 0),
    COUNT(*) FILTER (WHERE unit_weight > 0)
  INTO v_line_count, v_total_quantity, v_total_value, v_total_weight, v_weighted_line_count
  FROM inventory_receipt_items
  WHERE receipt_id = v_batch_id;

  FOR v_expense IN SELECT value FROM jsonb_array_elements(COALESCE(p_expenses, '[]'::JSONB))
  LOOP
    v_expense_type := COALESCE(NULLIF(v_expense->>'type', ''), 'other');
    v_expense_amount := COALESCE(NULLIF(v_expense->>'amount', '')::NUMERIC, 0);
    IF v_expense_type NOT IN ('freight', 'tariff', 'tax', 'handling', 'other') THEN
      RAISE EXCEPTION 'Unknown expense type: %.', v_expense_type;
    END IF;
    IF v_expense_amount < 0 THEN RAISE EXCEPTION 'Expense amounts cannot be negative.'; END IF;
    IF v_expense_amount = 0 THEN CONTINUE; END IF;

    v_expense_method := CASE
      WHEN v_mode = 'manual' THEN 'manual'
      WHEN v_expense_type = 'handling' THEN 'quantity'
      WHEN v_expense_type = 'freight' AND v_weighted_line_count = v_line_count AND v_total_weight > 0 THEN 'weight'
      WHEN v_total_value > 0 THEN 'value'
      ELSE 'quantity'
    END;

    INSERT INTO inventory_receipt_expenses (
      receipt_id, expense_type, label, amount, allocation_method
    ) VALUES (
      v_batch_id, v_expense_type,
      COALESCE(NULLIF(TRIM(v_expense->>'label'), ''), INITCAP(REPLACE(v_expense_type, '_', ' '))),
      v_expense_amount, v_expense_method
    );
  END LOOP;

  SELECT COALESCE(SUM(amount), 0) INTO v_expense_total
  FROM inventory_receipt_expenses WHERE receipt_id = v_batch_id;

  IF v_mode = 'manual' THEN
    SELECT COALESCE(SUM(allocated_expense), 0) INTO v_manual_total
    FROM inventory_receipt_items WHERE receipt_id = v_batch_id;
    IF ABS(v_manual_total - v_expense_total) > 0.009 THEN
      RAISE EXCEPTION 'Manual allocations (%) must equal shared expenses (%).', v_manual_total, v_expense_total;
    END IF;
  ELSE
    UPDATE inventory_receipt_items ri
    SET allocated_expense = ROUND(COALESCE((
      SELECT SUM(
        CASE e.allocation_method
          WHEN 'weight' THEN e.amount * (ri.quantity_received * ri.unit_weight) / NULLIF(v_total_weight, 0)
          WHEN 'quantity' THEN e.amount * ri.quantity_received / NULLIF(v_total_quantity, 0)
          ELSE e.amount * (ri.quantity_received * ri.supplier_unit_cost) / NULLIF(v_total_value, 0)
        END
      )
      FROM inventory_receipt_expenses e
      WHERE e.receipt_id = v_batch_id
    ), 0), 2)
    WHERE ri.receipt_id = v_batch_id;

    SELECT v_expense_total - COALESCE(SUM(allocated_expense), 0)
      INTO v_allocation_delta
    FROM inventory_receipt_items WHERE receipt_id = v_batch_id;

    IF v_allocation_delta <> 0 THEN
      UPDATE inventory_receipt_items
      SET allocated_expense = allocated_expense + v_allocation_delta
      WHERE id = (
        SELECT id FROM inventory_receipt_items
        WHERE receipt_id = v_batch_id
        ORDER BY (quantity_received * supplier_unit_cost) DESC, id
        LIMIT 1
      );
    END IF;
  END IF;

  UPDATE inventory_receipt_items
  SET landed_unit_cost = ROUND(
    supplier_unit_cost + allocated_expense / quantity_received,
    4
  )
  WHERE receipt_id = v_batch_id;

  UPDATE inventory inv
  SET amount = inv.amount + ri.quantity_received,
      cost_price = ROUND(
        ((inv.amount * COALESCE(inv.cost_price, 0)) +
         (ri.quantity_received * ri.landed_unit_cost)) /
        NULLIF(inv.amount + ri.quantity_received, 0),
        4
      )
  FROM inventory_receipt_items ri
  WHERE ri.receipt_id = v_batch_id
    AND inv.id = ri.inventory_id;

  UPDATE inventory_receipt_items ri
  SET new_average_cost = inv.cost_price
  FROM inventory inv
  WHERE ri.receipt_id = v_batch_id
    AND inv.id = ri.inventory_id;

  SELECT COALESCE(SUM(quantity_received * supplier_unit_cost), 0)
    INTO v_item_subtotal
  FROM inventory_receipt_items WHERE receipt_id = v_batch_id;

  UPDATE inventory_receipts
  SET item_subtotal = v_item_subtotal,
      shared_expenses = v_expense_total,
      landed_total = v_item_subtotal + v_expense_total
  WHERE id = v_batch_id;

  RETURN QUERY SELECT v_batch_id, v_batch_code;
END;
$$;

REVOKE ALL ON FUNCTION receive_inventory_batch(TEXT, TEXT, TEXT, DATE, TEXT, TEXT, JSONB, JSONB) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION receive_inventory_batch(TEXT, TEXT, TEXT, DATE, TEXT, TEXT, JSONB, JSONB) TO authenticated;

-- Best-effort backfill for old sales that do not have a cost snapshot yet.
UPDATE order_items oi
SET cost_price = COALESCE(inv.cost_price, 0)
FROM inventory inv
WHERE oi.item_id = inv.id
  AND oi.cost_price = 0;

-- Mark receipt-layer units as sold. This does not change a completed order's
-- snapshot cost; it only tells later receipt corrections what is still on hand.
CREATE OR REPLACE FUNCTION consume_receipt_layer_units()
RETURNS TRIGGER AS $$
DECLARE
  v_left INTEGER := NEW.quantity * COALESCE(NEW.base_units_per_sale, 1);
  v_layer RECORD;
  v_used INTEGER;
BEGIN
  IF NEW.item_id IS NULL OR NEW.quantity <= 0 THEN RETURN NEW; END IF;
  FOR v_layer IN
    SELECT ri.id, ri.remaining_quantity
    FROM inventory_receipt_items ri
    JOIN inventory_receipts r ON r.id = ri.receipt_id
    WHERE ri.inventory_id = NEW.item_id AND ri.remaining_quantity > 0
    ORDER BY r.received_date, r.created_at, ri.created_at
    FOR UPDATE OF ri
  LOOP
    EXIT WHEN v_left = 0;
    v_used := LEAST(v_left, v_layer.remaining_quantity);
    UPDATE inventory_receipt_items
    SET remaining_quantity = remaining_quantity - v_used
    WHERE id = v_layer.id;
    v_left := v_left - v_used;
  END LOOP;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS order_item_receipt_layer_consume ON order_items;
CREATE TRIGGER order_item_receipt_layer_consume
  AFTER INSERT ON order_items
  FOR EACH ROW EXECUTE FUNCTION consume_receipt_layer_units();

-- Add a missed receipt expense and apply it only to units still on hand from
-- that receipt. Completed sale snapshots deliberately remain unchanged.
CREATE OR REPLACE FUNCTION add_receipt_expense_correction(
  p_receipt_id UUID,
  p_expense_type TEXT,
  p_label TEXT,
  p_amount NUMERIC
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_line RECORD;
  v_total_qty NUMERIC;
  v_total_value NUMERIC;
  v_total_weight NUMERIC;
  v_all_weighted BOOLEAN;
  v_method TEXT;
  v_line_amount NUMERIC;
  v_inventory_amount INTEGER;
BEGIN
  IF NOT is_admin() THEN RAISE EXCEPTION 'Only an admin can correct a receipt.'; END IF;
  IF p_expense_type NOT IN ('freight', 'tariff', 'tax', 'handling', 'other') THEN RAISE EXCEPTION 'Unknown expense type.'; END IF;
  IF p_amount IS NULL OR p_amount <= 0 THEN RAISE EXCEPTION 'Expense must be greater than zero.'; END IF;

  SELECT COALESCE(SUM(quantity_received), 0),
    COALESCE(SUM(quantity_received * supplier_unit_cost), 0),
    COALESCE(SUM(quantity_received * unit_weight), 0),
    BOOL_AND(unit_weight > 0)
  INTO v_total_qty, v_total_value, v_total_weight, v_all_weighted
  FROM inventory_receipt_items WHERE receipt_id = p_receipt_id;
  IF v_total_qty = 0 THEN RAISE EXCEPTION 'Receipt not found.'; END IF;
  IF NOT EXISTS (
    SELECT 1 FROM inventory_receipt_items
    WHERE receipt_id = p_receipt_id AND remaining_quantity > 0
  ) THEN
    RAISE EXCEPTION 'No tracked units remain in this receipt.';
  END IF;

  v_method := CASE
    WHEN p_expense_type = 'handling' THEN 'quantity'
    WHEN p_expense_type = 'freight' AND v_all_weighted AND v_total_weight > 0 THEN 'weight'
    WHEN v_total_value > 0 THEN 'value'
    ELSE 'quantity'
  END;

  INSERT INTO inventory_receipt_expenses (receipt_id, expense_type, label, amount, allocation_method)
  VALUES (p_receipt_id, p_expense_type, COALESCE(NULLIF(TRIM(p_label), ''), INITCAP(p_expense_type)), p_amount, v_method);

  FOR v_line IN SELECT * FROM inventory_receipt_items WHERE receipt_id = p_receipt_id FOR UPDATE
  LOOP
    v_line_amount := ROUND(p_amount * CASE v_method
      WHEN 'weight' THEN (v_line.quantity_received * v_line.unit_weight) / NULLIF(v_total_weight, 0)
      WHEN 'quantity' THEN v_line.quantity_received / NULLIF(v_total_qty, 0)
      ELSE (v_line.quantity_received * v_line.supplier_unit_cost) / NULLIF(v_total_value, 0)
    END, 2);
    UPDATE inventory_receipt_items
    SET allocated_expense = allocated_expense + v_line_amount,
        landed_unit_cost = ROUND(supplier_unit_cost + (allocated_expense + v_line_amount) / quantity_received, 4)
    WHERE id = v_line.id;

    SELECT amount INTO v_inventory_amount FROM inventory WHERE id = v_line.inventory_id FOR UPDATE;
    IF v_inventory_amount > 0 AND v_line.remaining_quantity > 0 THEN
      UPDATE inventory
      SET cost_price = ROUND(cost_price + (v_line_amount / v_line.quantity_received) * LEAST(v_line.remaining_quantity, v_inventory_amount) / v_inventory_amount, 4)
      WHERE id = v_line.inventory_id;
    END IF;
  END LOOP;

  UPDATE inventory_receipts
  SET shared_expenses = shared_expenses + p_amount, landed_total = landed_total + p_amount
  WHERE id = p_receipt_id;
END;
$$;

REVOKE ALL ON FUNCTION add_receipt_expense_correction(UUID, TEXT, TEXT, NUMERIC) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION add_receipt_expense_correction(UUID, TEXT, TEXT, NUMERIC) TO authenticated;

-- Safely undo an untouched receipt. This refuses receipts with sold units or
-- later stock changes, so inventory and cost history cannot be corrupted.
CREATE OR REPLACE FUNCTION reverse_inventory_receipt(p_receipt_id UUID, p_delete_new_products BOOLEAN DEFAULT FALSE)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_line RECORD;
BEGIN
  IF NOT is_admin() THEN RAISE EXCEPTION 'Only an admin can reverse a receipt.'; END IF;
  FOR v_line IN SELECT * FROM inventory_receipt_items WHERE receipt_id = p_receipt_id FOR UPDATE LOOP
    IF v_line.remaining_quantity <> v_line.quantity_received THEN RAISE EXCEPTION 'Receipt contains sold units and cannot be reversed.'; END IF;
    IF NOT EXISTS (SELECT 1 FROM inventory WHERE id = v_line.inventory_id AND amount = v_line.previous_quantity + v_line.quantity_received) THEN RAISE EXCEPTION 'Inventory changed after this receipt; reversal is unsafe.'; END IF;
    IF p_delete_new_products AND v_line.previous_quantity = 0 THEN
      DELETE FROM inventory_receipt_items WHERE id = v_line.id;
      DELETE FROM inventory WHERE id = v_line.inventory_id;
    ELSE
      UPDATE inventory SET amount = v_line.previous_quantity, cost_price = v_line.previous_average_cost WHERE id = v_line.inventory_id;
    END IF;
  END LOOP;
  DELETE FROM inventory_receipts WHERE id = p_receipt_id;
END; $$;
GRANT EXECUTE ON FUNCTION reverse_inventory_receipt(UUID, BOOLEAN) TO authenticated;

-- Remove an inventory product safely. A sold product is never hard-deleted;
-- an unsold product may be removed together with its single-item receipt.
CREATE OR REPLACE FUNCTION delete_inventory_item(p_item_id TEXT)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_deleted INTEGER;
BEGIN
  IF NOT is_admin() THEN RAISE EXCEPTION 'Only an admin can delete inventory.'; END IF;
  IF NOT EXISTS (SELECT 1 FROM inventory WHERE id = p_item_id) THEN
    RAISE EXCEPTION 'Inventory item % does not exist.', p_item_id;
  END IF;
  IF EXISTS (SELECT 1 FROM order_items WHERE item_id = p_item_id) THEN
    RAISE EXCEPTION 'This product has sales history and cannot be deleted. Set its stock to zero or hide it instead.';
  END IF;
  IF EXISTS (SELECT 1 FROM inventory WHERE parent_id = p_item_id) THEN
    RAISE EXCEPTION 'This product has variants. Delete or move the variants first.';
  END IF;
  IF EXISTS (
    SELECT 1
    FROM inventory_receipt_items target
    JOIN inventory_receipt_items other ON other.receipt_id = target.receipt_id
    WHERE target.inventory_id = p_item_id AND other.inventory_id <> p_item_id
  ) THEN
    RAISE EXCEPTION 'This product belongs to a receipt with other products. Reverse that receipt first.';
  END IF;

  DELETE FROM cart_items WHERE item_id = p_item_id;

  DELETE FROM inventory_receipts receipt
  WHERE EXISTS (
    SELECT 1 FROM inventory_receipt_items item
    WHERE item.receipt_id = receipt.id AND item.inventory_id = p_item_id
  );

  DELETE FROM inventory WHERE id = p_item_id;
  GET DIAGNOSTICS v_deleted = ROW_COUNT;
  IF v_deleted <> 1 THEN RAISE EXCEPTION 'Product % could not be deleted.', p_item_id; END IF;
END;
$$;

REVOKE ALL ON FUNCTION delete_inventory_item(TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION delete_inventory_item(TEXT) TO authenticated;

-- ============================================================
-- DONE. New stock should be entered through Admin > Receive Stock.
-- ============================================================
