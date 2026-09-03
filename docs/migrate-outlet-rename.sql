-- Rename the tenant entity restaurant -> outlet (product serves cafes, juice
-- shops, and any F&B outlet, not just restaurants).
--
-- Run this ONCE, after schema.sql/seed.sql/migrate-i18n-columns.sql, on any
-- Supabase DB created before 2026-09-03. Fresh installs use the already
-- renamed docs/schema.sql / docs/seed.sql / docs/seed-i18n.sql /
-- docs/migrate-i18n-columns.sql and should skip this file entirely.
--
-- Idempotent: every statement is guarded so re-running after a partial or
-- full application is a no-op.
--
-- Note on grants: Supabase column/table grants (e.g. the "revoke select on
-- table restaurants from anon" + "grant select (...) on table restaurants to
-- anon" pair in schema.sql) follow the underlying table through a rename —
-- Postgres renames are metadata-only, the table's OID and its privileges are
-- unchanged. No grant statements need to be re-applied here.

begin;

do $$
begin
  if exists (select 1 from pg_tables where schemaname = 'public' and tablename = 'restaurants') then
    alter table public.restaurants rename to outlets;
  end if;
end $$;

do $$
declare
  t text;
begin
  foreach t in array array['tables', 'menu_categories', 'menu_items', 'sessions', 'orders', 'waiter_calls', 'staff']
  loop
    if exists (
      select 1 from information_schema.columns
      where table_schema = 'public' and table_name = t and column_name = 'restaurant_id'
    ) then
      execute format('alter table public.%I rename column restaurant_id to outlet_id', t);
    end if;
  end loop;
end $$;

-- idx_staff_pin and idx_waiter_calls_open never had "restaurant" in their
-- names, so they need no rename; their definitions follow the outlet_id
-- column rename above automatically.
do $$
begin
  if exists (select 1 from pg_class where relname = 'idx_menu_items_restaurant') then
    alter index public.idx_menu_items_restaurant rename to idx_menu_items_outlet;
  end if;
end $$;

do $$
begin
  if exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'outlets' and policyname = 'public can read restaurants'
  ) then
    alter policy "public can read restaurants" on public.outlets rename to "public can read outlets";
  end if;
end $$;

commit;
