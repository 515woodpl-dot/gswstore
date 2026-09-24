-- Required transaction/tax/customer classification fields for all new sales.
-- Legacy rows retain `legacy_unknown` rather than receiving invented history.
alter table public.orders
  add column if not exists buyer_type text not null default 'personal',
  add column if not exists payment_method text not null default 'legacy_unknown',
  add column if not exists tax_zip text not null default '',
  add column if not exists tax_city text not null default '',
  add column if not exists tax_exempt boolean not null default false,
  add column if not exists reseller_permit_status text not null default 'not_required',
  add column if not exists reseller_permit_path text,
  add column if not exists reseller_permit_filename text not null default '',
  add column if not exists reseller_permit_uploaded_at timestamptz,
  add column if not exists reseller_permit_reviewed_at timestamptz,
  add column if not exists reseller_permit_reviewed_by uuid references auth.users(id) on delete set null;

update public.orders
set payment_method = 'square'
where source in ('online', 'admin_payment_link') and payment_method = 'legacy_unknown';

alter table public.orders drop constraint if exists orders_buyer_type_check;
alter table public.orders add constraint orders_buyer_type_check check (buyer_type in ('personal', 'company'));
alter table public.orders drop constraint if exists orders_payment_method_check;
alter table public.orders add constraint orders_payment_method_check check (payment_method in ('cash', 'zelle', 'square', 'legacy_unknown'));
alter table public.orders drop constraint if exists orders_reseller_permit_status_check;
alter table public.orders add constraint orders_reseller_permit_status_check check (reseller_permit_status in ('not_required', 'approved', 'rejected'));
alter table public.orders drop constraint if exists orders_company_permit_check;
alter table public.orders add constraint orders_company_permit_check check (
  buyer_type = 'personal'
  or (reseller_permit_path is not null and reseller_permit_status in ('approved', 'rejected'))
);
alter table public.orders drop constraint if exists orders_tax_exemption_check;
alter table public.orders add constraint orders_tax_exemption_check check (
  tax_exempt = false
  or (buyer_type = 'company' and reseller_permit_status = 'approved' and reseller_permit_path is not null and tax_total = 0)
);

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('reseller-permits', 'reseller-permits', false, 10485760, array['application/pdf', 'image/jpeg', 'image/png'])
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;
