-- ============================================================
-- GSW — MIGRATION: Allow admins to delete walk-in/manual sales
-- Additive only. Safe to re-run.
-- ============================================================

DROP POLICY IF EXISTS orders_admin_delete ON orders;
CREATE POLICY orders_admin_delete ON orders
  FOR DELETE USING (is_admin());

DROP POLICY IF EXISTS order_items_admin_delete ON order_items;
CREATE POLICY order_items_admin_delete ON order_items
  FOR DELETE USING (is_admin());

-- ============================================================
-- DONE.
-- ============================================================
