-- Run once in Supabase SQL Editor.
-- Repairs historical sales created before cost snapshots were enabled.

-- This order was confirmed as a donation/internal-use transaction.
UPDATE orders
SET transaction_type = 'internal_use',
    internal_use_reason = 'Donation / loyalty'
WHERE order_number = 'GSW-20260801-S6EWQI';

CREATE OR REPLACE FUNCTION backfill_missing_sale_costs()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_updated INTEGER;
BEGIN
  IF NOT is_admin() THEN
    RAISE EXCEPTION 'Only an admin can repair historical sale costs.';
  END IF;

  UPDATE order_items oi
  SET cost_price = inventory.cost_price
  FROM inventory
  WHERE oi.item_id = inventory.id
    AND COALESCE(oi.cost_price, 0) <= 0
    AND COALESCE(inventory.cost_price, 0) > 0;

  GET DIAGNOSTICS v_updated = ROW_COUNT;
  RETURN v_updated;
END;
$$;

REVOKE ALL ON FUNCTION backfill_missing_sale_costs() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION backfill_missing_sale_costs() TO authenticated;
