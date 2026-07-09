-- ============================================================
-- Biriho Shop: secure, non-destructive database upgrade
-- ============================================================
-- Run this file ONCE in Supabase SQL Editor.
--
-- IMPORTANT:
-- 1. This file DOES NOT drop products or departments.
-- 2. It keeps every existing product and image URL.
-- 3. It adds authenticated-admin-only writes.
-- 4. It records automatic history before updates and deletes.
-- 5. The approved admin email is happycyusa02@gmail.com.
-- ============================================================

create extension if not exists pgcrypto;

-- Safe schema upgrades. These commands preserve existing rows.
alter table public.products
  add column if not exists price numeric(12,2);

alter table public.products
  add column if not exists updated_at timestamptz not null default now();

alter table public.departments
  add column if not exists updated_at timestamptz not null default now();

-- Prevent invalid negative prices.
do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'products_price_nonnegative'
      and conrelid = 'public.products'::regclass
  ) then
    alter table public.products
      add constraint products_price_nonnegative
      check (price is null or price >= 0);
  end if;
end $$;

-- Permanent audit/history table. A copy is saved automatically whenever a
-- product or department is inserted, updated, or deleted.
create table if not exists public.catalog_history (
  history_id bigint generated always as identity primary key,
  entity text not null check (entity in ('products', 'departments')),
  record_key text not null,
  operation text not null check (operation in ('SNAPSHOT', 'INSERT', 'UPDATE', 'DELETE')),
  snapshot jsonb not null,
  changed_at timestamptz not null default now(),
  changed_by uuid
);

create index if not exists catalog_history_entity_key_idx
  on public.catalog_history (entity, record_key, changed_at desc);

create or replace function public.biriho_is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select
    auth.role() = 'authenticated'
    and lower(coalesce(auth.jwt() ->> 'email', '')) = 'happycyusa02@gmail.com';
$$;

revoke all on function public.biriho_is_admin() from public;
grant execute on function public.biriho_is_admin() to anon, authenticated;

create or replace function public.set_biriho_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create or replace function public.log_biriho_catalog_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  row_snapshot jsonb;
  key_value text;
begin
  if tg_op = 'DELETE' then
    row_snapshot := to_jsonb(old);
  elsif tg_op = 'UPDATE' then
    -- Save the version that existed before the update, so it can be restored.
    row_snapshot := to_jsonb(old);
  else
    row_snapshot := to_jsonb(new);
  end if;

  if tg_table_name = 'products' then
    key_value := row_snapshot ->> 'id';
  else
    key_value := row_snapshot ->> 'name';
  end if;

  insert into public.catalog_history (
    entity,
    record_key,
    operation,
    snapshot,
    changed_by
  ) values (
    tg_table_name,
    key_value,
    tg_op,
    row_snapshot,
    auth.uid()
  );

  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end;
$$;

-- Recreate triggers safely if this script is run more than once.
drop trigger if exists products_set_updated_at on public.products;
create trigger products_set_updated_at
before update on public.products
for each row execute function public.set_biriho_updated_at();

drop trigger if exists departments_set_updated_at on public.departments;
create trigger departments_set_updated_at
before update on public.departments
for each row execute function public.set_biriho_updated_at();

drop trigger if exists products_catalog_history on public.products;
create trigger products_catalog_history
after insert or update or delete on public.products
for each row execute function public.log_biriho_catalog_change();

drop trigger if exists departments_catalog_history on public.departments;
create trigger departments_catalog_history
after insert or update or delete on public.departments
for each row execute function public.log_biriho_catalog_change();

-- Save one initial snapshot of every row that exists right now.
insert into public.catalog_history (entity, record_key, operation, snapshot, changed_by)
select 'products', p.id::text, 'SNAPSHOT', to_jsonb(p), auth.uid()
from public.products p
where not exists (
  select 1
  from public.catalog_history h
  where h.entity = 'products'
    and h.record_key = p.id::text
    and h.operation = 'SNAPSHOT'
);

insert into public.catalog_history (entity, record_key, operation, snapshot, changed_by)
select 'departments', d.name, 'SNAPSHOT', to_jsonb(d), auth.uid()
from public.departments d
where not exists (
  select 1
  from public.catalog_history h
  where h.entity = 'departments'
    and h.record_key = d.name
    and h.operation = 'SNAPSHOT'
);

-- Performance indexes.
create index if not exists products_department_idx
  on public.products (department);
create index if not exists products_created_at_idx
  on public.products (created_at);
create index if not exists departments_sort_order_idx
  on public.departments (sort_order, name);

-- Enable Row Level Security.
alter table public.products enable row level security;
alter table public.departments enable row level security;
alter table public.catalog_history enable row level security;

-- Remove the old unsafe policies that allowed anonymous writes.
drop policy if exists "Public write products" on public.products;
drop policy if exists "Public write departments" on public.departments;

drop policy if exists "Admin insert products" on public.products;
drop policy if exists "Admin update products" on public.products;
drop policy if exists "Admin delete products" on public.products;
drop policy if exists "Admin insert departments" on public.departments;
drop policy if exists "Admin update departments" on public.departments;
drop policy if exists "Admin delete departments" on public.departments;
drop policy if exists "Admin read catalog history" on public.catalog_history;

-- Keep public storefront read access.
do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'products'
      and policyname = 'Public read products'
  ) then
    create policy "Public read products"
      on public.products for select
      to anon, authenticated
      using (true);
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'departments'
      and policyname = 'Public read departments'
  ) then
    create policy "Public read departments"
      on public.departments for select
      to anon, authenticated
      using (true);
  end if;
end $$;

-- Only the authenticated Biriho admin can add, edit, or delete catalog data.
create policy "Admin insert products"
  on public.products for insert
  to authenticated
  with check (public.biriho_is_admin());

create policy "Admin update products"
  on public.products for update
  to authenticated
  using (public.biriho_is_admin())
  with check (public.biriho_is_admin());

create policy "Admin delete products"
  on public.products for delete
  to authenticated
  using (public.biriho_is_admin());

create policy "Admin insert departments"
  on public.departments for insert
  to authenticated
  with check (public.biriho_is_admin());

create policy "Admin update departments"
  on public.departments for update
  to authenticated
  using (public.biriho_is_admin())
  with check (public.biriho_is_admin());

create policy "Admin delete departments"
  on public.departments for delete
  to authenticated
  using (public.biriho_is_admin());

create policy "Admin read catalog history"
  on public.catalog_history for select
  to authenticated
  using (public.biriho_is_admin());

-- Prevent direct browser writes to history. Only database triggers write here.
revoke insert, update, delete on public.catalog_history from anon, authenticated;
grant select on public.catalog_history to authenticated;

analyze public.products;
analyze public.departments;
analyze public.catalog_history;

select
  'Biriho database secured without deleting products' as result,
  (select count(*) from public.products) as products_preserved,
  (select count(*) from public.departments) as departments_preserved,
  (select count(*) from public.catalog_history) as history_rows_created;
