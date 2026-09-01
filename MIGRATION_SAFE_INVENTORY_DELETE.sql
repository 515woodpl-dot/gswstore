-- Safe inventory deletion. Run once in Supabase; safe to re-run.
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
