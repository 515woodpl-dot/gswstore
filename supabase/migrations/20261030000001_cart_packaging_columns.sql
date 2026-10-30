-- Cart lines need their own package size so singles and boxes of the same
-- finish can coexist. Order lines retain that size after checkout.
ALTER TABLE public.cart_items
  ADD COLUMN IF NOT EXISTS sale_price numeric,
  ADD COLUMN IF NOT EXISTS base_unit text NOT NULL DEFAULT 'Each',
  ADD COLUMN IF NOT EXISTS selling_unit text NOT NULL DEFAULT 'Each',
  ADD COLUMN IF NOT EXISTS units_per_sale integer NOT NULL DEFAULT 1 CHECK (units_per_sale > 0);

ALTER TABLE public.order_items
  ADD COLUMN IF NOT EXISTS base_units_per_sale integer NOT NULL DEFAULT 1 CHECK (base_units_per_sale > 0);

NOTIFY pgrst, 'reload schema';
