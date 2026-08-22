-- Diagnostic: what columns does the inventory table actually have right now?
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'inventory'
ORDER BY ordinal_position;
