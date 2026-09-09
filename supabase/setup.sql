-- HADI MOBILE / Supabase setup
-- Run this entire file in Supabase > SQL Editor > New query.

create extension if not exists pgcrypto;

create table if not exists public.admins (
  user_id uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

create table if not exists public.categories (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  parent_id uuid references public.categories(id) on delete restrict,
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists public.products (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text not null default '',
  price numeric(12,2) not null check (price >= 0),
  image_url text,
  category_id uuid references public.categories(id) on delete restrict,
  in_stock boolean not null default true,
  featured boolean not null default false,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end $$;

drop trigger if exists set_products_updated_at on public.products;
create trigger set_products_updated_at before update on public.products
for each row execute function public.set_updated_at();

alter table public.admins enable row level security;
alter table public.categories enable row level security;
alter table public.products enable row level security;

drop policy if exists "Public read categories" on public.categories;
create policy "Public read categories" on public.categories for select using (true);

drop policy if exists "Public read active products" on public.products;
create policy "Public read active products" on public.products for select using (is_active = true or exists(select 1 from public.admins a where a.user_id = auth.uid()));

drop policy if exists "Admins read own row" on public.admins;
create policy "Admins read own row" on public.admins for select using (user_id = auth.uid());

drop policy if exists "Admins insert categories" on public.categories;
create policy "Admins insert categories" on public.categories for insert with check (exists(select 1 from public.admins a where a.user_id = auth.uid()));
drop policy if exists "Admins update categories" on public.categories;
create policy "Admins update categories" on public.categories for update using (exists(select 1 from public.admins a where a.user_id = auth.uid())) with check (exists(select 1 from public.admins a where a.user_id = auth.uid()));
drop policy if exists "Admins delete categories" on public.categories;
create policy "Admins delete categories" on public.categories for delete using (exists(select 1 from public.admins a where a.user_id = auth.uid()));

drop policy if exists "Admins insert products" on public.products;
create policy "Admins insert products" on public.products for insert with check (exists(select 1 from public.admins a where a.user_id = auth.uid()));
drop policy if exists "Admins update products" on public.products;
create policy "Admins update products" on public.products for update using (exists(select 1 from public.admins a where a.user_id = auth.uid())) with check (exists(select 1 from public.admins a where a.user_id = auth.uid()));
drop policy if exists "Admins delete products" on public.products;
create policy "Admins delete products" on public.products for delete using (exists(select 1 from public.admins a where a.user_id = auth.uid()));

insert into storage.buckets (id,name,public)
values ('product-images','product-images',true)
on conflict (id) do update set public = true;

drop policy if exists "Public product image read" on storage.objects;
create policy "Public product image read" on storage.objects for select using (bucket_id='product-images');

drop policy if exists "Admin image upload" on storage.objects;
create policy "Admin image upload" on storage.objects for insert
with check (bucket_id='product-images' and exists(select 1 from public.admins a where a.user_id = auth.uid()));

drop policy if exists "Admin image update" on storage.objects;
create policy "Admin image update" on storage.objects for update
using (bucket_id='product-images' and exists(select 1 from public.admins a where a.user_id = auth.uid()));

drop policy if exists "Admin image delete" on storage.objects;
create policy "Admin image delete" on storage.objects for delete
using (bucket_id='product-images' and exists(select 1 from public.admins a where a.user_id = auth.uid()));

-- Temporary editable categories. Delete/rename them from the admin panel anytime.
insert into public.categories(name,slug,sort_order) values
('Phones','phones',1),('Cases','cases',2),('Charging','charging',3),
('Audio','audio',4),('Power Banks','power-banks',5),('Smartwatches','smartwatches',6),
('Tablets','tablets',7),('Screen Protection','screen-protection',8),
('Car Accessories','car-accessories',9),('Gaming','gaming',10)
on conflict(slug) do nothing;
