-- Optional box offer on a finish. Stock remains on the finish's inventory row
-- and is always measured in individual tubes.
ALTER TABLE public.inventory
  ADD COLUMN IF NOT EXISTS box_enabled boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS box_price numeric(12, 2);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'inventory_box_price_valid'
      AND conrelid = 'public.inventory'::regclass
  ) THEN
    ALTER TABLE public.inventory
      ADD CONSTRAINT inventory_box_price_valid
      CHECK (NOT box_enabled OR (box_price > 0 AND units_per_sale = 1));
  END IF;
END;
$$;

-- The sealant product shown in the catalog has SKU SIL-0001. Its child rows
-- are the selectable finishes; each receives the same box offer.
UPDATE public.inventory AS finish
SET box_enabled = true, box_price = 98.40
WHERE finish.parent_id IN (
  SELECT id FROM public.inventory WHERE sku = 'SIL-0001'
)
AND finish.units_per_sale = 1;

-- Explicit pack size is supplied by the cart. Verify it against the catalog;
-- callers cannot choose an arbitrary stock conversion factor.
CREATE OR REPLACE FUNCTION public.decrement_packaged_inventory(
  p_item_id text,
  p_selling_qty integer,
  p_pack_size integer
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_stock integer;
  v_units_per_sale integer;
  v_box_enabled boolean;
  v_base_qty integer;
BEGIN
  IF p_selling_qty IS NULL OR p_selling_qty <= 0 THEN
    RAISE EXCEPTION 'Sale quantity must be greater than zero.';
  END IF;

  SELECT amount, units_per_sale, box_enabled
    INTO v_stock, v_units_per_sale, v_box_enabled
    FROM public.inventory WHERE id = p_item_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Inventory item % does not exist.', p_item_id; END IF;

  IF p_pack_size IS NULL OR NOT (
    p_pack_size = v_units_per_sale OR
    (p_pack_size = 24 AND v_box_enabled AND v_units_per_sale = 1)
  ) THEN
    RAISE EXCEPTION 'Package size is unavailable for %.', p_item_id;
  END IF;

  v_base_qty := p_selling_qty * p_pack_size;
  IF v_stock < v_base_qty THEN
    RAISE EXCEPTION 'Not enough stock for %. Need % base units; % remain.', p_item_id, v_base_qty, v_stock;
  END IF;
  UPDATE public.inventory SET amount = amount - v_base_qty WHERE id = p_item_id;
END;
$$;

REVOKE ALL ON FUNCTION public.decrement_packaged_inventory(text, integer, integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.decrement_packaged_inventory(text, integer, integer) TO authenticated, service_role;
