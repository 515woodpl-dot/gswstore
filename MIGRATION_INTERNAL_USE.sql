-- Run once in Supabase SQL Editor.
ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS transaction_type TEXT NOT NULL DEFAULT 'sale'
  CHECK (transaction_type IN ('sale', 'internal_use'));

ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS internal_use_reason TEXT NOT NULL DEFAULT '';
