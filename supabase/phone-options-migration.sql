-- HADI MOBILE: optional phone-model availability per product
-- Run this ONCE in Supabase > SQL Editor.

alter table public.products
add column if not exists has_phone_options boolean not null default false;

create table if not exists public.product_phone_options (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products(id) on delete cascade,
  phone_model text not null,
  in_stock boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  unique(product_id, phone_model)
);

alter table public.product_phone_options enable row level security;

drop policy if exists "Public read product phone options" on public.product_phone_options;
create policy "Public read product phone options"
on public.product_phone_options
for select
to anon, authenticated
using (true);

drop policy if exists "Admins insert product phone options" on public.product_phone_options;
create policy "Admins insert product phone options"
on public.product_phone_options
for insert
to authenticated
with check (
  exists (
    select 1 from public.admins
    where admins.user_id = auth.uid()
  )
);

drop policy if exists "Admins update product phone options" on public.product_phone_options;
create policy "Admins update product phone options"
on public.product_phone_options
for update
to authenticated
using (
  exists (
    select 1 from public.admins
    where admins.user_id = auth.uid()
  )
)
with check (
  exists (
    select 1 from public.admins
    where admins.user_id = auth.uid()
  )
);

drop policy if exists "Admins delete product phone options" on public.product_phone_options;
create policy "Admins delete product phone options"
on public.product_phone_options
for delete
to authenticated
using (
  exists (
    select 1 from public.admins
    where admins.user_id = auth.uid()
  )
);

grant select on public.product_phone_options to anon, authenticated;
grant insert, update, delete on public.product_phone_options to authenticated;

-- The admin already edits products, but this makes the new column available
-- under the same permissions as the rest of the product table.
grant select on public.products to anon, authenticated;
grant insert, update, delete on public.products to authenticated;

notify pgrst, 'reload schema';
