-- Distinguish an uncharged entry error from a paid item return.
ALTER TABLE public.sale_item_returns
  ADD COLUMN IF NOT EXISTS was_charged boolean NOT NULL DEFAULT true;

CREATE OR REPLACE FUNCTION public.return_completed_sale_item(
  p_order_id uuid,
  p_order_item_id uuid,
  p_quantity integer,
  p_reason text,
  p_actor_id uuid,
  p_was_charged boolean
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_order public.orders%ROWTYPE;
  v_item public.order_items%ROWTYPE;
  v_merchandise numeric(12,2);
  v_tax numeric(12,2);
  v_discount numeric(12,2);
  v_gross numeric(12,2);
  v_base_units integer;
  v_return_id uuid;
BEGIN
  IF p_was_charged IS NULL OR p_quantity IS NULL OR p_quantity <= 0 OR length(trim(coalesce(p_reason, ''))) < 3 THEN
    RAISE EXCEPTION 'Enter a valid quantity and a reason.';
  END IF;

  SELECT * INTO v_order FROM public.orders WHERE id = p_order_id FOR UPDATE;
  IF NOT FOUND OR v_order.source NOT IN ('walk_in', 'manual') OR v_order.status <> 'completed' THEN
    RAISE EXCEPTION 'Only completed walk-in or manual sales can be corrected here.';
  END IF;

  SELECT * INTO v_item FROM public.order_items
    WHERE id = p_order_item_id AND order_id = p_order_id FOR UPDATE;
  IF NOT FOUND OR p_quantity > v_item.quantity OR coalesce(v_item.cancelled_quantity, 0) > 0 THEN
    RAISE EXCEPTION 'That quantity is no longer available to return.';
  END IF;
  IF v_item.item_id IS NULL OR v_item.item_id LIKE 'manual-%' THEN
    RAISE EXCEPTION 'This line has no inventory item to restock.';
  END IF;

  v_base_units := p_quantity * greatest(coalesce(v_item.base_units_per_sale, 1), 1);
  v_merchandise := round((CASE WHEN v_item.net_amount > 0 THEN v_item.net_amount ELSE v_item.unit_price * v_item.quantity END) * p_quantity / v_item.quantity, 2);
  v_tax := round(v_item.tax_amount * p_quantity / v_item.quantity, 2);
  v_discount := round(v_item.discount_amount * p_quantity / v_item.quantity, 2);
  v_gross := v_merchandise + v_discount;

  IF NOT v_order.is_test THEN
    UPDATE public.inventory SET amount = amount + v_base_units WHERE id = v_item.item_id;
    IF NOT FOUND THEN RAISE EXCEPTION 'The inventory item no longer exists.'; END IF;
  END IF;

  INSERT INTO public.sale_item_returns (
    order_id, order_item_id, item_id, item_name, quantity, base_units,
    merchandise_amount, tax_amount, refund_due, was_charged, reason, actor_id
  ) VALUES (
    p_order_id, p_order_item_id, v_item.item_id, v_item.name, p_quantity, v_base_units,
    v_merchandise, v_tax, CASE WHEN p_was_charged THEN v_merchandise + v_tax ELSE 0 END, p_was_charged, trim(p_reason), p_actor_id
  ) RETURNING id INTO v_return_id;

  IF p_quantity = v_item.quantity THEN
    DELETE FROM public.order_items WHERE id = v_item.id;
  ELSE
    UPDATE public.order_items SET
      quantity = quantity - p_quantity,
      net_amount = greatest(0, net_amount - v_merchandise),
      tax_amount = greatest(0, tax_amount - v_tax),
      discount_amount = greatest(0, discount_amount - v_discount)
    WHERE id = v_item.id;
  END IF;

  UPDATE public.orders SET
    subtotal = greatest(0, subtotal - v_gross),
    discount_total = greatest(0, discount_total - v_discount),
    tax_total = greatest(0, tax_total - v_tax),
    total = greatest(0, total - v_merchandise - v_tax)
  WHERE id = p_order_id;

  RETURN jsonb_build_object(
    'returnId', v_return_id,
    'baseUnitsRestocked', CASE WHEN v_order.is_test THEN 0 ELSE v_base_units END,
    'refundDue', CASE WHEN p_was_charged THEN v_merchandise + v_tax ELSE 0 END
  );
END;
$$;

REVOKE ALL ON FUNCTION public.return_completed_sale_item(uuid, uuid, integer, text, uuid) FROM service_role;
REVOKE ALL ON FUNCTION public.return_completed_sale_item(uuid, uuid, integer, text, uuid, boolean) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.return_completed_sale_item(uuid, uuid, integer, text, uuid, boolean) TO service_role;

NOTIFY pgrst, 'reload schema';
