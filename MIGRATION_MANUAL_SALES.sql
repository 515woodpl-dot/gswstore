-- ============================================================
-- GSW — MIGRATION: Manual (backfilled) sales
-- Flags sales entered by hand for outages / offline periods.
-- Additive only. Safe to re-run.
-- ============================================================

-- source can now be 'online' | 'walk_in' | 'manual'
-- (no enum constraint on source, so no change needed there)

-- Optional free-text note explaining why a sale was entered manually.
ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS manual_note TEXT NOT NULL DEFAULT '';

-- ============================================================
-- DONE.
-- ============================================================
