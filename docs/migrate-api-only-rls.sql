-- The browser now talks only to Fastify. Keep RLS enabled as defense in depth,
-- but remove the old Supabase anon/authenticated read surface.
begin;

alter table audit_log enable row level security;

drop policy if exists "public can read outlets" on outlets;
drop policy if exists "public can read tables" on tables;
drop policy if exists "public can read menu categories" on menu_categories;
drop policy if exists "public can read menu items" on menu_items;

do $$
declare
  table_name text;
  role_name text;
begin
  foreach table_name in array array[
    'outlets', 'tables', 'menu_categories', 'menu_items', 'customers',
    'sessions', 'orders', 'order_items', 'payments', 'waiter_calls',
    'staff', 'audit_log'
  ] loop
    for role_name in
      select rolname from pg_roles where rolname in ('anon', 'authenticated')
    loop
      execute format('revoke all on table %I from %I', table_name, role_name);
    end loop;
  end loop;
end $$;

commit;
