-- Biriho Shop price and catalog performance migration
-- Run this once in Supabase SQL Editor.
-- It keeps all existing products and departments.

alter table public.products
  add column if not exists price numeric(12,2);

comment on column public.products.price is
  'Selling price in Rwandan francs (RWF). NULL means price on request.';

-- Prevent invalid negative prices while allowing products with no price yet.
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

-- These indexes make department filtering and ordered catalog loading faster.
create index if not exists products_department_idx
  on public.products (department);

create index if not exists products_created_at_idx
  on public.products (created_at);

create index if not exists departments_sort_order_idx
  on public.departments (sort_order, name);

analyze public.products;
analyze public.departments;

select 'Price and catalog performance features installed successfully' as result;
