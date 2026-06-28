-- Add "item_unavailable" status + a staff note field for customer-facing messages
ALTER TABLE orders DROP CONSTRAINT IF EXISTS orders_status_check;
ALTER TABLE orders ADD CONSTRAINT orders_status_check
  CHECK (status IN ('pending','confirmed','ready','completed','cancelled','item_unavailable'));
ALTER TABLE orders ADD COLUMN IF NOT EXISTS attention_note TEXT NOT NULL DEFAULT '';
