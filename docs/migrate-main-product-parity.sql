-- Additive, repeatable data migration for the product behavior that landed on
-- origin/main after the current API split. It deliberately does not restore
-- PIN auth or the deleted Next application.
begin;

alter table orders drop constraint if exists orders_placed_via_check;
alter table orders add constraint orders_placed_via_check
  check (placed_via in ('ui','anna','waiter'));

alter table order_items
  add column if not exists status text not null default 'queued',
  add column if not exists cancelled_at timestamptz,
  add column if not exists cancelled_by text;
alter table order_items drop constraint if exists order_items_status_check;
alter table order_items add constraint order_items_status_check
  check (status in ('queued','preparing','ready','served','cancelled'));

create table if not exists audit_log (
  id          uuid primary key default gen_random_uuid(),
  outlet_id   uuid not null references outlets(id) on delete cascade,
  staff_id    uuid references staff(id) on delete set null,
  role        text,
  actor_name  text,
  action      text not null,
  entity_type text not null,
  entity_id   uuid,
  details     jsonb,
  created_at  timestamptz not null default now()
);
create index if not exists idx_audit_log_outlet_created
  on audit_log(outlet_id, created_at desc);

commit;
