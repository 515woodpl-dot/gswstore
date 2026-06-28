-- Add featured flag (for homepage slideshow) and images array (for product gallery)
ALTER TABLE inventory ADD COLUMN IF NOT EXISTS featured BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE inventory ADD COLUMN IF NOT EXISTS images TEXT[] NOT NULL DEFAULT '{}';

-- Index to fetch featured items fast
CREATE INDEX IF NOT EXISTS idx_inventory_featured ON inventory(featured) WHERE featured = TRUE;
