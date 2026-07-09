-- ============================================================
-- Biriho Shop catalog recovery helpers
-- ============================================================
-- Run this after supabase/secure-database.sql.
-- It creates admin-only functions for restoring a product or department
-- from catalog_history.
-- ============================================================

create or replace function public.restore_product_from_history(p_history_id bigint)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  s jsonb;
  restored_id uuid;
begin
  if not public.biriho_is_admin() then
    raise exception 'Not authorized';
  end if;

  select snapshot
  into s
  from public.catalog_history
  where history_id = p_history_id
    and entity = 'products';

  if s is null then
    raise exception 'Product history row % was not found', p_history_id;
  end if;

  restored_id := (s ->> 'id')::uuid;

  if not exists (
    select 1 from public.departments
    where name = s ->> 'department'
  ) then
    raise exception 'Restore department % first', s ->> 'department';
  end if;

  insert into public.products (
    id,
    name,
    department,
    price,
    image,
    brand,
    sizes,
    specs,
    created_at,
    updated_at
  ) values (
    restored_id,
    s ->> 'name',
    s ->> 'department',
    nullif(s ->> 'price', '')::numeric,
    coalesce(s ->> 'image', ''),
    nullif(s ->> 'brand', ''),
    case
      when jsonb_typeof(s -> 'sizes') = 'array'
      then array(select jsonb_array_elements_text(s -> 'sizes'))
      else null
    end,
    case
      when jsonb_typeof(s -> 'specs') = 'array'
      then array(select jsonb_array_elements_text(s -> 'specs'))
      else '{}'::text[]
    end,
    coalesce(nullif(s ->> 'created_at', '')::timestamptz, now()),
    now()
  )
  on conflict (id) do update set
    name = excluded.name,
    department = excluded.department,
    price = excluded.price,
    image = excluded.image,
    brand = excluded.brand,
    sizes = excluded.sizes,
    specs = excluded.specs,
    updated_at = now();

  return restored_id;
end;
$$;

create or replace function public.restore_department_from_history(p_history_id bigint)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  s jsonb;
  restored_name text;
begin
  if not public.biriho_is_admin() then
    raise exception 'Not authorized';
  end if;

  select snapshot
  into s
  from public.catalog_history
  where history_id = p_history_id
    and entity = 'departments';

  if s is null then
    raise exception 'Department history row % was not found', p_history_id;
  end if;

  restored_name := s ->> 'name';

  insert into public.departments (name, icon, sort_order, updated_at)
  values (
    restored_name,
    coalesce(nullif(s ->> 'icon', ''), '📦'),
    coalesce(nullif(s ->> 'sort_order', '')::integer, 0),
    now()
  )
  on conflict (name) do update set
    icon = excluded.icon,
    sort_order = excluded.sort_order,
    updated_at = now();

  return restored_name;
end;
$$;

revoke all on function public.restore_product_from_history(bigint) from public;
revoke all on function public.restore_department_from_history(bigint) from public;
grant execute on function public.restore_product_from_history(bigint) to authenticated;
grant execute on function public.restore_department_from_history(bigint) to authenticated;

-- View recent deleted or overwritten products:
-- select history_id, record_key, operation, changed_at, snapshot ->> 'name' as product_name
-- from public.catalog_history
-- where entity = 'products'
-- order by changed_at desc;
--
-- Restore one product after signing in as the approved admin:
-- select public.restore_product_from_history(123);
