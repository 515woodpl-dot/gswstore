# Supabase SQL

All database SQL lives under this directory.

## Existing production database

Apply only migrations that have not already been run, in filename order. For
the sale-removal feature, run this file first in the Supabase SQL Editor:

```text
migrations/20260821220409_delete_sale.sql
```

The migration is safe to re-run.

## New database

For browser-based setup, run `schema/FULL_SCHEMA.sql`, then run the dated files
in `migrations/` from `20260630195304_reviews_attrs_tax.sql` onward, in filename
order.

For Supabase CLI setup, the complete dated migration sequence can be applied in
filename order.

## Directory layout

- `schema/` — full setup schema and the legacy two-file schema.
- `migrations/` — additive, chronological production changes.
- `maintenance/` — diagnostics and destructive repair scripts. Read each file
  before running it; `RESET_AND_BUILD.sql` deletes existing database data.

