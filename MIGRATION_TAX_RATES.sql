-- ============================================================
-- GSW — MIGRATION: WA Sales Tax Rates (ZIP+4 lookup table)
-- Stores the WA DOR quarterly tax rate file for ZIP-based lookup.
-- Safe to re-run — uses IF NOT EXISTS.
-- ============================================================

-- Tax rates table: one row per ZIP+4 combination.
-- ZIP-only lookups use the most common/highest rate for that ZIP.
CREATE TABLE IF NOT EXISTS tax_rates (
  id              BIGSERIAL PRIMARY KEY,
  zip             TEXT NOT NULL,        -- 5-digit ZIP
  plus4           TEXT NOT NULL,        -- 4-digit +4 suffix (use '0000' for ZIP-only)
  location_code   TEXT NOT NULL DEFAULT '',
  state_rate      NUMERIC NOT NULL,
  local_rate      NUMERIC NOT NULL,
  combined_rate   NUMERIC NOT NULL,
  effective_date  DATE,
  expiration_date DATE,
  uploaded_at     TIMESTAMPTZ DEFAULT NOW()
);

-- Primary lookup: ZIP + plus4
CREATE UNIQUE INDEX IF NOT EXISTS idx_tax_rates_zip4
  ON tax_rates(zip, plus4);

-- ZIP-only lookup (for walk-in, where +4 is unknown)
CREATE INDEX IF NOT EXISTS idx_tax_rates_zip
  ON tax_rates(zip);

-- Store settings: current store ZIP and its default tax rate
CREATE TABLE IF NOT EXISTS store_settings (
  key   TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

-- Insert default store ZIP (SeaTac) — update via admin UI
INSERT INTO store_settings (key, value)
VALUES ('store_zip', '98198')
ON CONFLICT (key) DO NOTHING;

-- RLS: only admins can read/write tax data
ALTER TABLE tax_rates ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tax_rates_admin ON tax_rates;
CREATE POLICY tax_rates_admin ON tax_rates
  FOR ALL USING (is_admin()) WITH CHECK (is_admin());

-- Store settings readable by anyone (needed for checkout tax calc)
ALTER TABLE store_settings ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS store_settings_read ON store_settings;
CREATE POLICY store_settings_read ON store_settings
  FOR SELECT USING (true);
DROP POLICY IF EXISTS store_settings_admin ON store_settings;
CREATE POLICY store_settings_admin ON store_settings
  FOR ALL USING (is_admin()) WITH CHECK (is_admin());

-- ============================================================
-- DONE.
-- Upload the WA DOR quarterly file via Admin → Tax Rates.
-- To look up a rate for a ZIP:
--   SELECT combined_rate FROM tax_rates
--   WHERE zip = '98198'
--   ORDER BY plus4
--   LIMIT 1;
-- ============================================================
