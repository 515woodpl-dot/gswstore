-- ============================================================
-- GSW — MIGRATION: Admin-Created Order + Online Payment + Fulfillment
-- Additive only. Safe to re-run.
-- Run once in the Supabase SQL editor (after 20260821220409_delete_sale.sql).
--
-- Reuses:
--   - orders / order_items (extended, not duplicated)
--   - walk_in_customers (generic guest-customer table; now also used for
--     admin_payment_link orders — gets a phone column)
--   - is_admin() for RLS
--   - decrement_packaged_inventory() pattern (mirrored by a restock fn below)
-- New:
--   - order_refunds  — one row per Square refund (full or partial)
--   - order_events   — admin/order audit timeline
--   - square_webhook_events — idempotency ledger for Square webhooks
-- ============================================================

-- ── 1. orders: payment + Square + lifecycle columns ──────────────────────────

ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS payment_status TEXT NOT NULL DEFAULT 'unpaid',
  ADD COLUMN IF NOT EXISTS is_test BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS customer_name TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS customer_email TEXT NOT NULL DEFAULT '';

ALTER TABLE orders DROP CONSTRAINT IF EXISTS orders_payment_status_check;
ALTER TABLE orders ADD CONSTRAINT orders_payment_status_check
  CHECK (payment_status IN ('unpaid','pending','paid','partially_refunded','refunded','failed'));

-- order_status gains three new lifecycle values used by admin payment-link
-- orders. Existing values are untouched.
ALTER TABLE orders DROP CONSTRAINT IF EXISTS orders_status_check;
ALTER TABLE orders ADD CONSTRAINT orders_status_check
  CHECK (status IN (
    'pending','confirmed','ready','completed','cancelled','item_unavailable',
    'draft','awaiting_payment','processing'
  ));

ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS subtotal                    NUMERIC NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS tax_rate                     NUMERIC NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS tax_total                    NUMERIC NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS amount_paid                  NUMERIC NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS amount_refunded              NUMERIC NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS internal_notes               TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS discount_type                TEXT NOT NULL DEFAULT '',   -- 'percent' | 'fixed' | ''
  ADD COLUMN IF NOT EXISTS discount_reason              TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS discounted_by                UUID REFERENCES auth.users(id),
  ADD COLUMN IF NOT EXISTS discounted_at                TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS customer_phone               TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS square_order_id               TEXT,
  ADD COLUMN IF NOT EXISTS square_payment_id             TEXT,
  ADD COLUMN IF NOT EXISTS square_payment_link_id        TEXT,
  ADD COLUMN IF NOT EXISTS square_payment_link_url       TEXT,
  ADD COLUMN IF NOT EXISTS square_payment_link_status    TEXT NOT NULL DEFAULT 'none', -- none|active|replaced|paid|cancelled
  ADD COLUMN IF NOT EXISTS square_receipt_url            TEXT,
  ADD COLUMN IF NOT EXISTS payment_link_sent_at          TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS paid_at                       TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS ready_at                      TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS completed_at                  TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS cancelled_at                  TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS cancellation_reason           TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS cancellation_note             TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS cancelled_by                  UUID REFERENCES auth.users(id),
  ADD COLUMN IF NOT EXISTS refund_failed_reason          TEXT NOT NULL DEFAULT '';

ALTER TABLE orders DROP CONSTRAINT IF EXISTS orders_link_status_check;
ALTER TABLE orders ADD CONSTRAINT orders_link_status_check
  CHECK (square_payment_link_status IN ('none','active','replaced','paid','cancelled'));

-- Walk-in orders / manual sales are always settled at the register.
UPDATE orders SET payment_status = 'paid'
  WHERE payment_status = 'unpaid' AND source IN ('walk_in','manual') AND status = 'completed';

CREATE INDEX IF NOT EXISTS idx_orders_square_order_id   ON orders(square_order_id);
CREATE INDEX IF NOT EXISTS idx_orders_square_payment_id ON orders(square_payment_id);
CREATE INDEX IF NOT EXISTS idx_orders_payment_status    ON orders(payment_status);
CREATE INDEX IF NOT EXISTS idx_orders_is_test           ON orders(is_test);

-- ── 2. walk_in_customers: add phone, reused as the generic guest-customer
--    table for admin_payment_link orders too (source column already free-text) ─

ALTER TABLE walk_in_customers ADD COLUMN IF NOT EXISTS phone TEXT NOT NULL DEFAULT '';

-- ── 3. order_items: cancellation / fulfillment tracking ──────────────────────

ALTER TABLE order_items
  ADD COLUMN IF NOT EXISTS status               TEXT NOT NULL DEFAULT 'active',
  ADD COLUMN IF NOT EXISTS cancelled_quantity    INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS fulfilled_quantity    INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS tax_amount            NUMERIC NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS net_amount            NUMERIC NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS discount_type         TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS discounted_by         UUID REFERENCES auth.users(id),
  ADD COLUMN IF NOT EXISTS discounted_at         TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS cancellation_reason   TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS cancellation_note     TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS cancelled_at          TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS cancelled_by          UUID REFERENCES auth.users(id),
  ADD COLUMN IF NOT EXISTS refunded_amount       NUMERIC NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS refunded_tax_amount   NUMERIC NOT NULL DEFAULT 0;

ALTER TABLE order_items DROP CONSTRAINT IF EXISTS order_items_status_check;
ALTER TABLE order_items ADD CONSTRAINT order_items_status_check
  CHECK (status IN ('active','cancelled'));

ALTER TABLE order_items DROP CONSTRAINT IF EXISTS order_items_cancelled_qty_check;
ALTER TABLE order_items ADD CONSTRAINT order_items_cancelled_qty_check
  CHECK (cancelled_quantity >= 0 AND cancelled_quantity <= quantity);

-- ── 4. order_refunds — one row per Square refund (full item or whole order) ──

CREATE TABLE IF NOT EXISTS order_refunds (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id         UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  order_item_id    UUID REFERENCES order_items(id) ON DELETE SET NULL,
  square_refund_id TEXT,
  square_payment_id TEXT,
  amount           NUMERIC NOT NULL CHECK (amount >= 0),
  status           TEXT NOT NULL DEFAULT 'creating', -- creating|pending|completed|failed
  reason           TEXT NOT NULL DEFAULT '',
  created_by       UUID REFERENCES auth.users(id),
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  confirmed_at     TIMESTAMPTZ,
  -- Captures what to apply once Square confirms the refund is COMPLETED:
  -- { fullOrder: true } or { lines: [{ orderItemId, cancelQty }] }.
  meta             JSONB NOT NULL DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS idx_order_refunds_order ON order_refunds(order_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_order_refunds_square_id ON order_refunds(square_refund_id) WHERE square_refund_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_order_refunds_one_active
  ON order_refunds(order_id) WHERE status IN ('creating','pending');

ALTER TABLE order_refunds ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS order_refunds_admin_all ON order_refunds;
CREATE POLICY order_refunds_admin_all ON order_refunds FOR ALL USING (is_admin()) WITH CHECK (is_admin());

-- ── 5. order_events — admin/order audit timeline ─────────────────────────────

CREATE TABLE IF NOT EXISTS order_events (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id       UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  event_type     TEXT NOT NULL,
  actor_id       UUID REFERENCES auth.users(id),
  actor_name     TEXT NOT NULL DEFAULT '',
  previous_value JSONB,
  new_value      JSONB,
  reason         TEXT NOT NULL DEFAULT '',
  square_ref     TEXT,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_order_events_order ON order_events(order_id, created_at);

ALTER TABLE order_events ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS order_events_admin_all ON order_events;
CREATE POLICY order_events_admin_all ON order_events FOR ALL USING (is_admin()) WITH CHECK (is_admin());

-- ── 6. square_webhook_events — idempotency ledger ────────────────────────────

CREATE TABLE IF NOT EXISTS square_webhook_events (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  square_event_id TEXT NOT NULL UNIQUE,
  event_type      TEXT NOT NULL,
  order_id        UUID REFERENCES orders(id) ON DELETE SET NULL,
  payload         JSONB NOT NULL,
  received_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  processed_at    TIMESTAMPTZ,
  processing_started_at TIMESTAMPTZ,
  process_error   TEXT
);

ALTER TABLE square_webhook_events ENABLE ROW LEVEL SECURITY;
-- No client policies: only the service-role key (used by the webhook route)
-- reads/writes this table, and service role bypasses RLS entirely.

CREATE TABLE IF NOT EXISTS admin_order_requests (
  request_key UUID PRIMARY KEY,
  order_id UUID REFERENCES orders(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'in_progress' CHECK (status IN ('in_progress','recoverable','completed')),
  response JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE admin_order_requests ENABLE ROW LEVEL SECURITY;

-- ── 7. restock_packaged_inventory — mirror of decrement_packaged_inventory ───
--    Used when a paid/reserved item is cancelled and stock must come back.

CREATE OR REPLACE FUNCTION restock_packaged_inventory(p_item_id TEXT, p_selling_qty INTEGER)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_units_per_sale INTEGER;
  v_base_qty INTEGER;
BEGIN
  IF p_selling_qty IS NULL OR p_selling_qty <= 0 THEN
    RETURN; -- nothing to restock
  END IF;

  SELECT units_per_sale INTO v_units_per_sale
  FROM inventory WHERE id = p_item_id FOR UPDATE;

  IF NOT FOUND THEN
    RETURN; -- product may have since been deleted; nothing to restock
  END IF;

  v_base_qty := p_selling_qty * GREATEST(COALESCE(v_units_per_sale, 1), 1);
  UPDATE inventory SET amount = amount + v_base_qty WHERE id = p_item_id;
END;
$$;

REVOKE ALL ON FUNCTION restock_packaged_inventory(TEXT, INTEGER) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION restock_packaged_inventory(TEXT, INTEGER) TO service_role;

-- Atomically claim a webhook delivery. Failed deliveries clear
-- processing_started_at in the route so Square can retry immediately; an
-- abandoned claim becomes retryable after five minutes.
CREATE OR REPLACE FUNCTION claim_square_webhook_event(
  p_event_id TEXT,
  p_event_type TEXT,
  p_payload JSONB
) RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_inserted INTEGER;
BEGIN
  INSERT INTO square_webhook_events(square_event_id, event_type, payload, processing_started_at)
  VALUES (p_event_id, p_event_type, p_payload, NOW())
  ON CONFLICT (square_event_id) DO NOTHING;
  GET DIAGNOSTICS v_inserted = ROW_COUNT;
  IF v_inserted = 1 THEN RETURN TRUE; END IF;

  UPDATE square_webhook_events
  SET processing_started_at = NOW(), process_error = NULL
  WHERE square_event_id = p_event_id
    AND processed_at IS NULL
    AND (processing_started_at IS NULL OR processing_started_at < NOW() - INTERVAL '5 minutes');
  RETURN FOUND;
END;
$$;

REVOKE ALL ON FUNCTION claim_square_webhook_event(TEXT, TEXT, JSONB) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION claim_square_webhook_event(TEXT, TEXT, JSONB) TO service_role;

-- Apply every refund side effect in one database transaction. If any stock,
-- item, or order update fails, PostgreSQL rolls the entire finalization back
-- and the pending refund remains safe to retry from the webhook.
CREATE OR REPLACE FUNCTION finalize_order_refund(p_refund_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_refund order_refunds%ROWTYPE;
  v_order orders%ROWTYPE;
  v_item order_items%ROWTYPE;
  v_line JSONB;
  v_cancel_qty INTEGER;
  v_old_cancelled INTEGER;
  v_new_cancelled INTEGER;
  v_item_cents BIGINT := 0;
  v_tax_cents BIGINT := 0;
  v_subtract_cents BIGINT := 0;
  v_item_subtract_cents BIGINT := 0;
  v_tax_subtract_cents BIGINT := 0;
  v_gross_subtract_cents BIGINT := 0;
  v_discount_subtract_cents BIGINT := 0;
  v_nothing_left BOOLEAN := FALSE;
BEGIN
  SELECT * INTO v_refund FROM order_refunds WHERE id = p_refund_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Refund intent not found'; END IF;
  IF v_refund.status = 'completed' THEN RETURN jsonb_build_object('applied', FALSE, 'alreadyCompleted', TRUE); END IF;
  IF v_refund.status <> 'pending' THEN RAISE EXCEPTION 'Refund is not pending'; END IF;

  SELECT * INTO v_order FROM orders WHERE id = v_refund.order_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Order not found'; END IF;

  IF v_refund.meta->>'kind' = 'full' THEN
    IF NOT v_order.is_test THEN
      UPDATE inventory AS inv
      SET amount = inv.amount + ((oi.quantity - COALESCE(oi.cancelled_quantity, 0)) * GREATEST(COALESCE(oi.base_units_per_sale, 1), 1))
      FROM order_items AS oi
      WHERE oi.order_id = v_order.id
        AND oi.item_id = inv.id
        AND oi.quantity > COALESCE(oi.cancelled_quantity, 0);
    END IF;

    UPDATE order_items
    SET status = 'cancelled', cancelled_quantity = quantity, cancelled_at = NOW()
    WHERE order_id = v_order.id;

    UPDATE orders
    SET status = 'cancelled',
        payment_status = 'refunded',
        amount_refunded = LEAST(amount_paid, amount_refunded + v_refund.amount),
        cancelled_at = NOW(),
        square_payment_link_status = CASE WHEN square_payment_link_status = 'active' THEN 'cancelled' ELSE square_payment_link_status END
    WHERE id = v_order.id;
  ELSE
    FOR v_line IN SELECT value FROM jsonb_array_elements(COALESCE(v_refund.meta->'lines', '[]'::jsonb)) LOOP
      SELECT * INTO v_item FROM order_items
      WHERE id = (v_line->>'orderItemId')::UUID AND order_id = v_order.id
      FOR UPDATE;
      IF NOT FOUND THEN RAISE EXCEPTION 'Refund item not found'; END IF;

      v_cancel_qty := (v_line->>'cancelQty')::INTEGER;
      v_old_cancelled := COALESCE(v_item.cancelled_quantity, 0);
      v_new_cancelled := v_old_cancelled + v_cancel_qty;
      IF v_cancel_qty <= 0 OR v_new_cancelled > v_item.quantity THEN
        RAISE EXCEPTION 'Refund quantity is no longer available';
      END IF;

      v_item_cents := ROUND(v_item.net_amount * 100 * v_new_cancelled / v_item.quantity)
                    - ROUND(v_item.net_amount * 100 * v_old_cancelled / v_item.quantity);
      v_tax_cents := ROUND(v_item.tax_amount * 100 * v_new_cancelled / v_item.quantity)
                   - ROUND(v_item.tax_amount * 100 * v_old_cancelled / v_item.quantity);

      IF NOT v_order.is_test THEN
        UPDATE inventory
        SET amount = amount + (v_cancel_qty * GREATEST(COALESCE(v_item.base_units_per_sale, 1), 1))
        WHERE id = v_item.item_id;
        IF NOT FOUND THEN RAISE EXCEPTION 'Inventory item not found'; END IF;
      END IF;

      UPDATE order_items
      SET cancelled_quantity = v_new_cancelled,
          status = CASE WHEN v_new_cancelled = quantity THEN 'cancelled' ELSE 'active' END,
          refunded_amount = refunded_amount + v_item_cents / 100.0,
          refunded_tax_amount = refunded_tax_amount + v_tax_cents / 100.0,
          cancelled_at = NOW()
      WHERE id = v_item.id;
      v_subtract_cents := v_subtract_cents + v_item_cents + v_tax_cents;
      v_item_subtract_cents := v_item_subtract_cents + v_item_cents;
      v_tax_subtract_cents := v_tax_subtract_cents + v_tax_cents;
      v_gross_subtract_cents := v_gross_subtract_cents
        + ROUND(COALESCE(v_item.list_price, v_item.unit_price) * 100 * v_new_cancelled / v_item.quantity)
        - ROUND(COALESCE(v_item.list_price, v_item.unit_price) * 100 * v_old_cancelled / v_item.quantity);
      v_discount_subtract_cents := v_gross_subtract_cents - v_item_subtract_cents;
    END LOOP;

    SELECT NOT EXISTS (
      SELECT 1 FROM order_items WHERE order_id = v_order.id AND cancelled_quantity < quantity
    ) INTO v_nothing_left;

    UPDATE orders
    SET total = GREATEST(0, total - v_subtract_cents / 100.0),
        subtotal = GREATEST(0, subtotal - v_gross_subtract_cents / 100.0),
        discount_total = GREATEST(0, discount_total - v_discount_subtract_cents / 100.0),
        tax_total = GREATEST(0, tax_total - v_tax_subtract_cents / 100.0),
        amount_refunded = LEAST(amount_paid, amount_refunded + v_refund.amount),
        payment_status = CASE WHEN amount_refunded + v_refund.amount >= amount_paid THEN 'refunded' ELSE 'partially_refunded' END,
        status = CASE WHEN v_nothing_left AND status <> 'completed' THEN 'cancelled' ELSE status END,
        cancelled_at = CASE WHEN v_nothing_left AND status <> 'completed' THEN NOW() ELSE cancelled_at END
    WHERE id = v_order.id;
  END IF;

  UPDATE order_refunds SET status = 'completed', confirmed_at = NOW() WHERE id = v_refund.id;
  RETURN jsonb_build_object('applied', TRUE, 'kind', v_refund.meta->>'kind', 'amount', v_refund.amount);
END;
$$;

REVOKE ALL ON FUNCTION finalize_order_refund(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION finalize_order_refund(UUID) TO service_role;

CREATE OR REPLACE FUNCTION cancel_unpaid_order(
  p_order_id UUID,
  p_reason TEXT,
  p_actor_id UUID
) RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_order orders%ROWTYPE;
BEGIN
  SELECT * INTO v_order FROM orders WHERE id = p_order_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Order not found'; END IF;
  IF v_order.payment_status NOT IN ('unpaid','pending','failed') THEN RAISE EXCEPTION 'Paid orders require a refund'; END IF;
  IF v_order.status = 'cancelled' THEN RETURN FALSE; END IF;

  IF NOT v_order.is_test THEN
    UPDATE inventory AS inv
    SET amount = inv.amount + ((oi.quantity - COALESCE(oi.cancelled_quantity, 0)) * GREATEST(COALESCE(oi.base_units_per_sale, 1), 1))
    FROM order_items AS oi
    WHERE oi.order_id = p_order_id AND oi.item_id = inv.id AND oi.quantity > COALESCE(oi.cancelled_quantity, 0);
  END IF;

  UPDATE order_items
  SET status = 'cancelled', cancelled_quantity = quantity, cancelled_at = NOW(), cancelled_by = p_actor_id
  WHERE order_id = p_order_id;

  UPDATE orders
  SET status = 'cancelled', cancellation_reason = p_reason, cancelled_by = p_actor_id,
      cancelled_at = NOW(), square_payment_link_status = CASE WHEN square_payment_link_status = 'active' THEN 'cancelled' ELSE square_payment_link_status END
  WHERE id = p_order_id;
  RETURN TRUE;
END;
$$;

REVOKE ALL ON FUNCTION cancel_unpaid_order(UUID, TEXT, UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION cancel_unpaid_order(UUID, TEXT, UUID) TO service_role;

CREATE OR REPLACE FUNCTION cancel_unpaid_order_item(
  p_order_id UUID,
  p_order_item_id UUID,
  p_cancel_qty INTEGER,
  p_reason TEXT,
  p_note TEXT,
  p_actor_id UUID
) RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_order orders%ROWTYPE;
  v_item order_items%ROWTYPE;
  v_new_cancelled INTEGER;
BEGIN
  SELECT * INTO v_order FROM orders WHERE id = p_order_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Order not found'; END IF;
  IF v_order.payment_status NOT IN ('unpaid','pending','failed') THEN RAISE EXCEPTION 'Paid orders require a refund'; END IF;

  SELECT * INTO v_item FROM order_items WHERE id = p_order_item_id AND order_id = p_order_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Order item not found'; END IF;
  v_new_cancelled := COALESCE(v_item.cancelled_quantity, 0) + p_cancel_qty;
  IF p_cancel_qty <= 0 OR v_new_cancelled > v_item.quantity THEN RAISE EXCEPTION 'Invalid cancellation quantity'; END IF;

  IF NOT v_order.is_test THEN
    UPDATE inventory
    SET amount = amount + (p_cancel_qty * GREATEST(COALESCE(v_item.base_units_per_sale, 1), 1))
    WHERE id = v_item.item_id;
    IF NOT FOUND THEN RAISE EXCEPTION 'Inventory item not found'; END IF;
  END IF;

  UPDATE order_items
  SET cancelled_quantity = v_new_cancelled,
      status = CASE WHEN v_new_cancelled = quantity THEN 'cancelled' ELSE 'active' END,
      cancellation_reason = p_reason, cancellation_note = p_note,
      cancelled_at = NOW(), cancelled_by = p_actor_id
  WHERE id = v_item.id;

  WITH totals AS (
    SELECT
      COALESCE(SUM(ROUND(COALESCE(list_price, unit_price) * 100 * (quantity - cancelled_quantity) / quantity)), 0) AS gross_cents,
      COALESCE(SUM(ROUND(net_amount * 100 * (quantity - cancelled_quantity) / quantity)), 0) AS net_cents,
      COALESCE(SUM(ROUND(tax_amount * 100 * (quantity - cancelled_quantity) / quantity)), 0) AS tax_cents
    FROM order_items WHERE order_id = p_order_id AND quantity > cancelled_quantity
  )
  UPDATE orders
  SET subtotal = totals.gross_cents / 100.0,
      discount_total = (totals.gross_cents - totals.net_cents) / 100.0,
      tax_total = totals.tax_cents / 100.0,
      total = (totals.net_cents + totals.tax_cents) / 100.0,
      square_payment_link_status = CASE WHEN square_payment_link_status = 'active' THEN 'replaced' ELSE square_payment_link_status END
  FROM totals WHERE id = p_order_id;
  RETURN v_new_cancelled;
END;
$$;

REVOKE ALL ON FUNCTION cancel_unpaid_order_item(UUID, UUID, INTEGER, TEXT, TEXT, UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION cancel_unpaid_order_item(UUID, UUID, INTEGER, TEXT, TEXT, UUID) TO service_role;

-- Also make sure the service-role webhook handler can call the existing
-- decrement function under whatever role it runs as (service_role bypasses
-- GRANT checks already, kept here for clarity/documentation only).
GRANT EXECUTE ON FUNCTION decrement_packaged_inventory(TEXT, INTEGER) TO service_role;

-- ============================================================
-- DONE.
-- New order source value used going forward: 'admin_payment_link'
-- (orders.source is free-text — no constraint change needed).
-- ============================================================
