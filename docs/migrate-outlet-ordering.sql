-- Additive migration for outlet-scoped customer ordering.
-- Existing sessions/tables are dine-in; existing outlets with tables keep QR ordering.
begin;

alter table outlets
  add column if not exists tables_enabled boolean;

-- Only legacy NULLs are backfilled. An explicit false is an intentional
-- table-disabled setting and must survive a repeat run.
update outlets o
set tables_enabled = exists (select 1 from tables t where t.outlet_id = o.id)
where tables_enabled is null;

alter table outlets alter column tables_enabled set default false;
update outlets set tables_enabled = false where tables_enabled is null;
alter table outlets alter column tables_enabled set not null;

alter table sessions
  add column if not exists service_type text not null default 'dine_in';

alter table sessions
  alter column table_id drop not null;

alter table sessions drop constraint if exists sessions_service_type_check;
alter table sessions add constraint sessions_service_type_check
  check (service_type in ('dine_in','takeaway'));

alter table sessions drop constraint if exists sessions_service_type_table_check;
alter table sessions add constraint sessions_service_type_table_check
  check ((service_type = 'dine_in' and table_id is not null)
      or (service_type = 'takeaway' and table_id is null));

create index if not exists idx_sessions_outlet on sessions(outlet_id, status, created_at desc);

commit;
