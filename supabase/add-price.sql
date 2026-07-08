-- Biriho Shop price feature migration
-- Run this once in Supabase SQL Editor.
-- It keeps all existing products and only adds the new price field.

alter table public.products
  add column if not exists price numeric(12,2);

comment on column public.products.price is
  'Selling price in Rwandan francs (RWF). NULL means price on request.';

-- Prevent negative prices while allowing existing products to remain without a price.
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

select 'Price feature installed successfully' as result;
