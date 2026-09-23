-- Test payment-link orders now exercise the real local inventory lifecycle.
-- This flag distinguishes them from older isolated tests that never reserved
-- stock, so cleanup can never accidentally add inventory.
ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS test_inventory_reserved BOOLEAN NOT NULL DEFAULT FALSE;

CREATE OR REPLACE FUNCTION delete_test_order_and_restore_inventory(p_order_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_order orders%ROWTYPE;
BEGIN
  SELECT * INTO v_order FROM orders WHERE id = p_order_id FOR UPDATE;
  IF NOT FOUND THEN RETURN FALSE; END IF;
  IF NOT v_order.is_test THEN
    RAISE EXCEPTION 'Only test orders can be deleted with test cleanup.';
  END IF;

  IF v_order.test_inventory_reserved THEN
    UPDATE inventory AS inv
    SET amount = inv.amount + (
      oi.quantity * GREATEST(COALESCE(oi.base_units_per_sale, 1), 1)
    )
    FROM order_items AS oi
    WHERE oi.order_id = p_order_id
      AND oi.item_id = inv.id;
  END IF;

  DELETE FROM admin_order_requests WHERE order_id = p_order_id;
  DELETE FROM orders WHERE id = p_order_id;
  RETURN TRUE;
END;
$$;

REVOKE ALL ON FUNCTION delete_test_order_and_restore_inventory(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION delete_test_order_and_restore_inventory(UUID) TO service_role;
