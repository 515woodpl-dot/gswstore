-- ============================================================
-- GSW - Ordered shipments on the Order & Receive Stock screen
-- Run once in the Supabase SQL Editor. Safe to re-run.
--
-- "Save as ordered" stores the whole shipment form here until the goods arrive.
-- It reuses the existing purchase_orders table: one new column, nothing else.
-- Stock, costs, and products are NOT touched until the shipment is received.
-- ============================================================

ALTER TABLE purchase_orders ADD COLUMN IF NOT EXISTS shipment JSONB;

-- Make sure admins can add, change, and delete these rows.
DROP POLICY IF EXISTS po_admin_all ON purchase_orders;
CREATE POLICY po_admin_all ON purchase_orders
  FOR ALL USING (is_admin()) WITH CHECK (is_admin());

GRANT SELECT, INSERT, UPDATE, DELETE ON purchase_orders TO authenticated;
