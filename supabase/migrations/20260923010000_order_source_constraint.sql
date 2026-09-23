-- Keep the documented order origins closed to typos without rewriting or
-- deleting any historical rows that may predate this constraint.
ALTER TABLE orders DROP CONSTRAINT IF EXISTS orders_source_check;
ALTER TABLE orders ADD CONSTRAINT orders_source_check
  CHECK (source IN ('online', 'walk_in', 'manual', 'admin_payment_link'))
  NOT VALID;

-- A NOT VALID check applies to every new/updated row immediately. Validate it
-- fully when the existing data already consists only of documented sources.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM orders
    WHERE source NOT IN ('online', 'walk_in', 'manual', 'admin_payment_link')
  ) THEN
    ALTER TABLE orders VALIDATE CONSTRAINT orders_source_check;
  END IF;
END;
$$;

-- The consolidated server-side sale writer uses the packaged inventory RPC.
-- Keep this safe for databases where that legacy RPC was installed separately.
DO $$
BEGIN
  IF to_regprocedure('public.decrement_packaged_inventory(text,integer)') IS NOT NULL THEN
    EXECUTE 'GRANT EXECUTE ON FUNCTION decrement_packaged_inventory(TEXT, INTEGER) TO service_role';
  END IF;
END;
$$;
