-- Additive, repeatable migration for optional customer phone/password accounts.
begin;

create table if not exists customers (
  id            uuid primary key default gen_random_uuid(),
  phone         text not null,
  first_name    text not null,
  last_name     text,
  password_hash text not null,
  active        boolean not null default true,
  created_at    timestamptz not null default now()
);

create unique index if not exists idx_customers_phone on customers(phone);

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'customers_phone_format') then
    alter table customers add constraint customers_phone_format
      check (phone ~ '^\+[0-9]{8,15}$');
  end if;
  if not exists (select 1 from pg_constraint where conname = 'customers_first_name_format') then
    alter table customers add constraint customers_first_name_format
      check (first_name = btrim(first_name) and char_length(first_name) between 1 and 60);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'customers_last_name_format') then
    alter table customers add constraint customers_last_name_format
      check (last_name is null or (last_name = btrim(last_name) and char_length(last_name) between 1 and 60));
  end if;
end $$;

alter table sessions add column if not exists customer_id uuid;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'sessions_customer_id_fkey') then
    alter table sessions add constraint sessions_customer_id_fkey
      foreign key (customer_id) references customers(id) on delete set null;
  end if;
end $$;

alter table customers enable row level security;

commit;
