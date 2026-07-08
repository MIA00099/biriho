-- Biriho Shop Supabase setup
-- Safe for both a new project and an existing Biriho database.

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

-- Upgrade older Biriho databases without deleting data.
alter table public.products add column if not exists price numeric(12,2);

alter table public.departments enable row level security;
alter table public.products enable row level security;

do $$
begin
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='departments' and policyname='Public read departments') then
    create policy "Public read departments" on public.departments for select using (true);
  end if;
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='products' and policyname='Public read products') then
    create policy "Public read products" on public.products for select using (true);
  end if;
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='departments' and policyname='Public write departments') then
    create policy "Public write departments" on public.departments for all using (true) with check (true);
  end if;
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='products' and policyname='Public write products') then
    create policy "Public write products" on public.products for all using (true) with check (true);
  end if;
end $$;

select 'Biriho Shop database is ready' as result;
