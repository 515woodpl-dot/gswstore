CREATE TABLE IF NOT EXISTS discount_codes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  code TEXT NOT NULL UNIQUE,
  percent_off NUMERIC NOT NULL CHECK (percent_off > 0 AND percent_off <= 100),
  active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE discount_codes ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS discount_codes_admin_all ON discount_codes;
CREATE POLICY discount_codes_admin_all ON discount_codes FOR ALL USING (is_admin()) WITH CHECK (is_admin());
DROP POLICY IF EXISTS discount_codes_authenticated_read ON discount_codes;
CREATE POLICY discount_codes_authenticated_read ON discount_codes FOR SELECT USING (active = TRUE);
ALTER TABLE orders ADD COLUMN IF NOT EXISTS promo_code TEXT NOT NULL DEFAULT '';
ALTER TABLE orders ADD COLUMN IF NOT EXISTS promo_percent NUMERIC NOT NULL DEFAULT 0;
GRANT SELECT, INSERT, UPDATE, DELETE ON discount_codes TO authenticated;
