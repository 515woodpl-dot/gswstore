-- ============================================================
-- GSW — MIGRATION: Allow admins to edit completed sale line items
-- Additive only. Safe to re-run.
-- ============================================================

DROP POLICY IF EXISTS order_items_admin_update ON order_items;
CREATE POLICY order_items_admin_update ON order_items
  FOR UPDATE USING (is_admin()) WITH CHECK (is_admin());

-- (orders already has orders_admin_update from earlier schema.)

-- ============================================================
-- DONE.
-- ============================================================
