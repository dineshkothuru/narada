-- Transactional, repeatable migration from the PIN/display-name schema.
begin;

alter table outlets add column if not exists active boolean not null default true;
alter table staff add column if not exists username text;
alter table staff add column if not exists first_name text;
alter table staff add column if not exists last_name text;
alter table staff add column if not exists password_hash text;

update staff set username = nullif(lower(btrim(username)), '') where username is not null;
update staff set last_name = nullif(btrim(last_name), '') where last_name is not null;
update staff set first_name = nullif(btrim(first_name), '') where first_name is not null;

-- Legacy names are a display string; keep it intact as first_name and never
-- guess a first/last split. The nullable username is enrolled by an admin.
do $$
begin
  if exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'staff' and column_name = 'name') then
    update staff set first_name = nullif(btrim(name), '') where first_name is null;
  end if;
end $$;

do $$
begin
  if exists (
    select outlet_id, username from staff where username is not null
    group by outlet_id, username having count(*) > 1
  ) then
    raise exception 'duplicate staff usernames (case-insensitive) must be resolved before password auth';
  end if;
end $$;

-- Known legacy indexes only; don't drop unrelated future indexes by name.
drop index if exists idx_staff_name_ci;
drop index if exists idx_staff_pin;
drop index if exists staff_name_idx;
drop index if exists staff_pin_idx;
drop index if exists idx_outlets_admin_pin;
drop index if exists outlets_admin_pin_idx;

alter table staff alter column first_name drop not null;
alter table staff alter column username drop not null;
alter table staff alter column last_name drop not null;
alter table staff alter column password_hash drop not null;
alter table staff drop column if exists pin;
alter table outlets drop column if exists admin_pin;
alter table staff drop column if exists name;

create unique index if not exists idx_staff_username on staff(outlet_id, username) where username is not null;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'staff_username_format') then
    alter table staff add constraint staff_username_format check (username is null or (username = lower(username) and username ~ '^[a-z0-9._-]{3,32}$'));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'staff_first_name_format') then
    alter table staff add constraint staff_first_name_format check (first_name is null or (first_name = btrim(first_name) and char_length(first_name) between 1 and 60));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'staff_last_name_format') then
    alter table staff add constraint staff_last_name_format check (last_name is null or (last_name = btrim(last_name) and char_length(last_name) between 1 and 60));
  end if;
end $$;
commit;
