-- Biriho Shop Supabase setup
-- Non-destructive: this file never deletes existing products or departments.

create extension if not exists pgcrypto;

create table if not exists public.departments (
  name text primary key,
  icon text not null default '📦',
  sort_order integer not null default 0
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
  constraint products_price_nonnegative check (price is null or price >= 0)
);

alter table public.products add column if not exists price numeric(12,2);

create index if not exists products_department_idx on public.products (department);
create index if not exists products_created_at_idx on public.products (created_at);
create index if not exists departments_sort_order_idx on public.departments (sort_order, name);

alter table public.departments enable row level security;
alter table public.products enable row level security;

drop policy if exists "Public read departments" on public.departments;
drop policy if exists "Public read products" on public.products;
drop policy if exists "Public write departments" on public.departments;
drop policy if exists "Public write products" on public.products;

create policy "Public read departments" on public.departments for select using (true);
create policy "Public read products" on public.products for select using (true);
create policy "Public write departments" on public.departments for all using (true) with check (true);
create policy "Public write products" on public.products for all using (true) with check (true);

analyze public.products;
analyze public.departments;

select
  'Biriho Shop database is ready' as result,
  (select count(*) from public.products) as products_preserved,
  (select count(*) from public.departments) as departments_preserved;
