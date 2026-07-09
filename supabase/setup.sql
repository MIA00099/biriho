-- ============================================================
-- Biriho Shop: safe base database setup
-- ============================================================
-- This file is NON-DESTRUCTIVE. It never drops products or departments.
-- For an existing database, run supabase/secure-database.sql instead.
-- ============================================================

create extension if not exists pgcrypto;

create table if not exists public.departments (
  name text primary key,
  icon text not null default '📦',
  sort_order integer not null default 0,
  updated_at timestamptz not null default now()
);

create table if not exists public.products (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  department text not null references public.departments(name) on update cascade on delete restrict,
  price numeric(12,2),
  image text not null default '',
  brand text,
  sizes text[],
  specs text[] not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint products_price_nonnegative check (price is null or price >= 0)
);

-- Safe upgrades for older Biriho databases. Existing rows are preserved.
alter table public.products add column if not exists price numeric(12,2);
alter table public.products add column if not exists updated_at timestamptz not null default now();
alter table public.departments add column if not exists updated_at timestamptz not null default now();

create index if not exists products_department_idx on public.products (department);
create index if not exists products_created_at_idx on public.products (created_at);
create index if not exists departments_sort_order_idx on public.departments (sort_order, name);

alter table public.departments enable row level security;
alter table public.products enable row level security;

-- Remove the old unsafe anonymous-write policies if they exist.
drop policy if exists "Public write products" on public.products;
drop policy if exists "Public write departments" on public.departments;

-- Public visitors may read the catalog.
do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname='public' and tablename='products' and policyname='Public read products'
  ) then
    create policy "Public read products"
      on public.products for select
      to anon, authenticated
      using (true);
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname='public' and tablename='departments' and policyname='Public read departments'
  ) then
    create policy "Public read departments"
      on public.departments for select
      to anon, authenticated
      using (true);
  end if;
end $$;

-- The complete admin-only write policies, automatic history and recovery
-- protection are installed by supabase/secure-database.sql.

analyze public.products;
analyze public.departments;

select
  'Safe Biriho base setup complete. Run secure-database.sql next.' as result,
  (select count(*) from public.products) as products_preserved,
  (select count(*) from public.departments) as departments_preserved;
