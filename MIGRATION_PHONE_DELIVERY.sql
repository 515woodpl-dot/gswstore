-- ============================================================
-- GSW — MIGRATION: Phone on signup + Delivery option
-- Additive only. Safe to re-run.
-- Run once in the Supabase SQL editor.
-- ============================================================

-- ── Orders: delivery method + address + delivery fee ─────────────────────────
-- fulfillment: 'pickup' (default, free) or 'delivery'
-- delivery_address: full address text collected at checkout for delivery orders
-- delivery_fee: set by staff later when processing (0 = free, e.g. $100+ orders)
ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS fulfillment      TEXT    NOT NULL DEFAULT 'pickup',
  ADD COLUMN IF NOT EXISTS delivery_address TEXT    NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS delivery_fee     NUMERIC NOT NULL DEFAULT 0;

-- Phone is captured on signup into auth user metadata (raw_user_meta_data.phone),
-- so no column change is required for the phone number itself. If you also want a
-- profiles table copy, uncomment below (only if a `profiles` table exists):
-- ALTER TABLE profiles ADD COLUMN IF NOT EXISTS phone TEXT NOT NULL DEFAULT '';

-- ============================================================
-- DONE.
-- ============================================================
