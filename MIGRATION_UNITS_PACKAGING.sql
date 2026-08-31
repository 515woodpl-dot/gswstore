ALTER TABLE inventory ADD COLUMN IF NOT EXISTS base_unit TEXT NOT NULL DEFAULT 'Each';
ALTER TABLE inventory ADD COLUMN IF NOT EXISTS selling_unit TEXT NOT NULL DEFAULT 'Each';
ALTER TABLE inventory ADD COLUMN IF NOT EXISTS units_per_sale INTEGER NOT NULL DEFAULT 1 CHECK (units_per_sale > 0);
ALTER TABLE order_items ADD COLUMN IF NOT EXISTS base_units_per_sale INTEGER NOT NULL DEFAULT 1;
ALTER TABLE cart_items ADD COLUMN IF NOT EXISTS base_unit TEXT NOT NULL DEFAULT 'Each';
ALTER TABLE cart_items ADD COLUMN IF NOT EXISTS selling_unit TEXT NOT NULL DEFAULT 'Each';
ALTER TABLE cart_items ADD COLUMN IF NOT EXISTS units_per_sale INTEGER NOT NULL DEFAULT 1 CHECK (units_per_sale > 0);

-- Stock is stored in base units. These fields describe the package a supplier ships.
ALTER TABLE inventory_receipt_items ADD COLUMN IF NOT EXISTS purchase_unit TEXT NOT NULL DEFAULT 'Each';
ALTER TABLE inventory_receipt_items ADD COLUMN IF NOT EXISTS base_units_per_purchase INTEGER NOT NULL DEFAULT 1 CHECK (base_units_per_purchase > 0);
ALTER TABLE inventory_receipt_items ADD COLUMN IF NOT EXISTS purchase_quantity_received INTEGER NOT NULL DEFAULT 0 CHECK (purchase_quantity_received >= 0);

-- Existing receipt rows were already recorded as base units.
UPDATE inventory_receipt_items
SET purchase_quantity_received = quantity_received
WHERE purchase_quantity_received = 0;
