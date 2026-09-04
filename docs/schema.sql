-- Outlet QR Ordering — Supabase schema
-- Applied via Supabase Management API / SQL editor.

create extension if not exists "pgcrypto";

-- One row per outlet (multi-tenant ready, single tenant to start)
create table if not exists outlets (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  slug        text not null unique,
  upi_vpa     text,                       -- for upi:// deep-link payments
  currency    text not null default 'INR',
  tables_enabled boolean not null default false,
  -- admin setting: 'post' = order fires first, pay at the end (default; leaves
  -- room to engage the customer between order and bill); 'pre' = pay to order
  payment_timing text not null default 'post' check (payment_timing in ('pre','post')),
  active        boolean not null default true,
  created_at  timestamptz not null default now()
);

-- Physical tables in the outlet; QR encodes /t/<table.code>
create table if not exists tables (
  id            uuid primary key default gen_random_uuid(),
  outlet_id     uuid not null references outlets(id) on delete cascade,
  label         text not null,            -- "Table 12"
  code          text not null unique,     -- short random slug in the QR URL
  created_at    timestamptz not null default now()
);

create table if not exists menu_categories (
  id            uuid primary key default gen_random_uuid(),
  outlet_id     uuid not null references outlets(id) on delete cascade,
  name          text not null,
  emoji         text,
  sort_order    int not null default 0
);

create table if not exists menu_items (
  id            uuid primary key default gen_random_uuid(),
  outlet_id     uuid not null references outlets(id) on delete cascade,
  category_id   uuid not null references menu_categories(id) on delete cascade,
  name          text not null,
  description   text,
  price_inr     numeric(10,2) not null,
  is_veg        boolean not null default true,
  spice_level   int not null default 0 check (spice_level between 0 and 3),
  allergens     text[] not null default '{}',
  tags          text[] not null default '{}',   -- "bestseller", "chef-special"
  image_url     text,
  is_available  boolean not null default true,
  sort_order    int not null default 0
);

-- Optional customer account. Ordering remains guest-capable; this identity is
-- only attached to visits created while the account cookie is present.
create table if not exists customers (
  id            uuid primary key default gen_random_uuid(),
  phone         text not null unique
                check (phone ~ '^\+[0-9]{8,15}$'),
  first_name    text not null
                check (first_name = btrim(first_name) and char_length(first_name) between 1 and 60),
  last_name     text
                check (last_name is null or (last_name = btrim(last_name) and char_length(last_name) between 1 and 60)),
  password_hash text not null,
  active        boolean not null default true,
  created_at    timestamptz not null default now()
);

-- A dining session: created on QR scan, holds the running tab for that table visit
create table if not exists sessions (
  id            uuid primary key default gen_random_uuid(),
  table_id      uuid references tables(id) on delete cascade,
  outlet_id     uuid not null references outlets(id) on delete cascade,
  customer_id   uuid references customers(id) on delete set null,
  service_type  text not null default 'dine_in'
                check (service_type in ('dine_in','takeaway')),
  status        text not null default 'active'   -- active | billed | closed
                check (status in ('active','billed','closed')),
  created_at    timestamptz not null default now(),
  closed_at     timestamptz
);

-- One order = one round fired to the kitchen (a session can have many)
create table if not exists orders (
  id            uuid primary key default gen_random_uuid(),
  session_id    uuid not null references sessions(id) on delete cascade,
  outlet_id     uuid not null references outlets(id) on delete cascade,
  status        text not null default 'placed'   -- placed | preparing | served | cancelled
                check (status in ('placed','preparing','served','cancelled')),
  total_inr     numeric(10,2) not null default 0,
  placed_via    text not null default 'ui'       -- ui | anna | waiter
                check (placed_via in ('ui','anna','waiter')),
  created_at    timestamptz not null default now()
);

create table if not exists order_items (
  id           uuid primary key default gen_random_uuid(),
  order_id     uuid not null references orders(id) on delete cascade,
  menu_item_id uuid not null references menu_items(id),
  name         text not null,               -- denormalized: menu edits must not rewrite history
  unit_price   numeric(10,2) not null,
  qty          int not null check (qty > 0),
  notes        text,                         -- "less spicy", "no onion"
  status       text not null default 'queued'
               check (status in ('queued','preparing','ready','served','cancelled')),
  cancelled_at timestamptz,
  cancelled_by text
);

create table if not exists payments (
  id          uuid primary key default gen_random_uuid(),
  session_id  uuid not null references sessions(id) on delete cascade,
  amount_inr  numeric(10,2) not null,
  method      text not null default 'upi_intent'
              check (method in ('upi_intent','cash','card')),
  status      text not null default 'pending'
              check (status in ('pending','confirmed','failed')),
  reference   text,                                 -- gateway payment id / staff note
  created_at  timestamptz not null default now()
);

create index if not exists idx_menu_items_outlet on menu_items(outlet_id, category_id, sort_order);
create index if not exists idx_tables_outlet on tables(outlet_id);
create index if not exists idx_menu_categories_outlet on menu_categories(outlet_id);
create index if not exists idx_menu_items_category on menu_items(category_id);
create index if not exists idx_sessions_customer on sessions(customer_id);
create index if not exists idx_orders_session on orders(session_id);
create index if not exists idx_orders_outlet on orders(outlet_id);
create index if not exists idx_order_items_order on order_items(order_id);
create index if not exists idx_order_items_menu_item on order_items(menu_item_id);
create index if not exists idx_payments_session on payments(session_id);
create index if not exists idx_sessions_table on sessions(table_id) where status = 'active';
create index if not exists idx_sessions_outlet on sessions(outlet_id, status, created_at desc);
-- Row Level Security: the browser uses the API only. Keep RLS enabled and do
-- not grant anon/authenticated direct table access.
alter table outlets          enable row level security;
alter table tables          enable row level security;
alter table menu_categories enable row level security;
alter table menu_items      enable row level security;
alter table customers       enable row level security;
alter table sessions        enable row level security;
alter table orders          enable row level security;
alter table order_items     enable row level security;
alter table payments        enable row level security;

-- Kitchen dashboard live updates
alter publication supabase_realtime add table orders;

-- ============================================================
-- v2 additions (applied to the live project; needed for fresh installs)
-- ============================================================

alter table outlets
  add column if not exists tables_enabled boolean not null default false,
  add column if not exists payment_timing text not null default 'post'
    check (payment_timing in ('pre','post')),
  add column if not exists comp_item_id uuid references menu_items(id);

create index if not exists idx_outlets_comp_item on outlets(comp_item_id);

alter table menu_categories
  add column if not exists name_hi text,
  add column if not exists name_te text;

alter table menu_items
  add column if not exists name_hi text,
  add column if not exists name_te text,
  add column if not exists description_hi text,
  add column if not exists description_te text,
  add column if not exists emoji text;

alter table sessions
  add column if not exists service_type text not null default 'dine_in'
    check (service_type in ('dine_in','takeaway')),
  add column if not exists discount_pct int not null default 0
    check (discount_pct between 0 and 50),
  add column if not exists comp_awarded boolean not null default false;

alter table sessions drop constraint if exists sessions_service_type_table_check;
alter table sessions add constraint sessions_service_type_table_check
  check ((service_type = 'dine_in' and table_id is not null)
      or (service_type = 'takeaway' and table_id is null));

alter table orders add column if not exists placed_by text;

alter table order_items add column if not exists status text not null default 'queued'
  check (status in ('queued','preparing','served'));

create table if not exists waiter_calls (
  id            uuid primary key default gen_random_uuid(),
  table_id      uuid not null references tables(id) on delete cascade,
  outlet_id     uuid not null references outlets(id) on delete cascade,
  status        text not null default 'open' check (status in ('open','done')),
  created_at    timestamptz not null default now()
);
alter table waiter_calls enable row level security;
create index if not exists idx_waiter_calls_open on waiter_calls(table_id) where status = 'open';
create index if not exists idx_waiter_calls_outlet on waiter_calls(outlet_id);

create table if not exists staff (
  id            uuid primary key default gen_random_uuid(),
  outlet_id     uuid not null references outlets(id) on delete cascade,
  username      text not null check (username = lower(username) and username ~ '^[a-z0-9._-]{3,32}$'),
  first_name    text not null check (first_name = btrim(first_name) and char_length(first_name) between 1 and 60),
  last_name     text check (last_name is null or (last_name = btrim(last_name) and char_length(last_name) between 1 and 60)),
  role          text not null check (role in ('admin','kitchen','waiter','reception','cashier')),
  password_hash text not null,
  active        boolean not null default true,
  created_at    timestamptz not null default now()
);
alter table staff enable row level security;
create unique index if not exists idx_staff_username on staff(outlet_id, username);

-- one active session per table (order/reward races resolve on this)
create unique index if not exists uniq_active_session_per_table
  on sessions(table_id) where status = 'active';

-- ============================================================
-- v3 additions (live columns; see docs/migrate-live-columns.sql for the
-- migration that brings a pre-existing DB up to this shape)
-- ============================================================

alter table outlets
  add column if not exists service_charge_pct numeric(5,2) not null default 0,
  add column if not exists gstin text,
  add column if not exists bill_seq int not null default 0; -- monotonic invoice counter

alter table tables
  add column if not exists ui_variant text not null default 'classic'
    check (ui_variant in ('classic','stories')),
  add column if not exists capacity int not null default 4,
  add column if not exists zone text,
  add column if not exists needs_cleaning boolean not null default false;

alter table menu_categories
  add column if not exists kind text not null default 'food'
    check (kind in ('food','drink'));

alter table menu_items
  add column if not exists gst_pct numeric(5,2) not null default 5;

alter table sessions
  add column if not exists guests int,
  add column if not exists attendant text,             -- waiter who claimed the table
  add column if not exists merged_into uuid references sessions(id),
  add column if not exists service_waived boolean not null default false,
  add column if not exists bill_no text,                -- minted once, at bill time
  add column if not exists bill_gross numeric(10,2),
  add column if not exists bill_discount numeric(10,2),
  add column if not exists bill_gst numeric(10,2),
  add column if not exists bill_service numeric(10,2),
  add column if not exists bill_tip numeric(10,2),
  add column if not exists bill_net numeric(10,2),
  add column if not exists tip_to text,                 -- attendant frozen at bill time
  add column if not exists settled_at timestamptz;

create index if not exists idx_sessions_merged_into on sessions(merged_into);

alter table orders
  add column if not exists lang text; -- en | hi | te

alter table order_items
  add column if not exists gst_pct numeric(5,2) not null default 5; -- frozen from the menu item

alter table waiter_calls
  add column if not exists acked_at timestamptz,
  add column if not exists acked_by text;

-- kitchen/waiter screens move orders and order_items through a 'ready' state
alter table orders drop constraint if exists orders_status_check;
alter table orders add constraint orders_status_check
  check (status in ('placed','preparing','ready','served','cancelled'));

alter table order_items drop constraint if exists order_items_status_check;
alter table order_items add constraint order_items_status_check
  check (status in ('queued','preparing','ready','served','cancelled'));

alter table orders drop constraint if exists orders_placed_via_check;
alter table orders add constraint orders_placed_via_check
  check (placed_via in ('ui','anna','waiter'));

alter table order_items
  add column if not exists cancelled_at timestamptz,
  add column if not exists cancelled_by text;

-- Audit events are outlet-owned so a staff member can never inspect another
-- outlet's operational history through a shared database connection.
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
alter table audit_log enable row level security;
create index if not exists idx_audit_log_outlet_created
  on audit_log(outlet_id, created_at desc);
create index if not exists idx_audit_log_staff on audit_log(staff_id);

-- No anon/authenticated grants: all application reads and writes go through
-- the API's privileged database connection.

-- Dish photos live in a public Supabase Storage bucket named "menu";
-- menu_items.image_url points at the public object URL. Create it once with:
--   POST /storage/v1/bucket {"id":"menu","public":true,
--     "file_size_limit":5242880,
--     "allowed_mime_types":["image/jpeg","image/png","image/webp","image/avif"]}
