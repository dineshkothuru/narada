-- Restaurant QR Ordering — Supabase schema
-- Applied via Supabase Management API / SQL editor.

create extension if not exists "pgcrypto";

-- One row per restaurant (multi-tenant ready, single tenant to start)
create table if not exists restaurants (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  slug        text not null unique,
  upi_vpa     text,                       -- for upi:// deep-link payments
  currency    text not null default 'INR',
  -- admin setting: 'post' = order fires first, pay at the end (default; leaves
  -- room to engage the customer between order and bill); 'pre' = pay to order
  payment_timing text not null default 'post' check (payment_timing in ('pre','post')),
  created_at  timestamptz not null default now()
);

-- Physical tables in the restaurant; QR encodes /t/<table.code>
create table if not exists tables (
  id            uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references restaurants(id) on delete cascade,
  label         text not null,            -- "Table 12"
  code          text not null unique,     -- short random slug in the QR URL
  created_at    timestamptz not null default now()
);

create table if not exists menu_categories (
  id            uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references restaurants(id) on delete cascade,
  name          text not null,
  emoji         text,
  sort_order    int not null default 0
);

create table if not exists menu_items (
  id            uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references restaurants(id) on delete cascade,
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

-- A dining session: created on QR scan, holds the running tab for that table visit
create table if not exists sessions (
  id            uuid primary key default gen_random_uuid(),
  table_id      uuid not null references tables(id) on delete cascade,
  restaurant_id uuid not null references restaurants(id) on delete cascade,
  status        text not null default 'active'   -- active | billed | closed
                check (status in ('active','billed','closed')),
  created_at    timestamptz not null default now(),
  closed_at     timestamptz
);

-- One order = one round fired to the kitchen (a session can have many)
create table if not exists orders (
  id            uuid primary key default gen_random_uuid(),
  session_id    uuid not null references sessions(id) on delete cascade,
  restaurant_id uuid not null references restaurants(id) on delete cascade,
  status        text not null default 'placed'   -- placed | preparing | served | cancelled
                check (status in ('placed','preparing','served','cancelled')),
  total_inr     numeric(10,2) not null default 0,
  placed_via    text not null default 'ui'       -- ui | anna (voice/chat agent)
                check (placed_via in ('ui','anna')),
  created_at    timestamptz not null default now()
);

create table if not exists order_items (
  id           uuid primary key default gen_random_uuid(),
  order_id     uuid not null references orders(id) on delete cascade,
  menu_item_id uuid not null references menu_items(id),
  name         text not null,               -- denormalized: menu edits must not rewrite history
  unit_price   numeric(10,2) not null,
  qty          int not null check (qty > 0),
  notes        text                          -- "less spicy", "no onion"
);

create table if not exists payments (
  id          uuid primary key default gen_random_uuid(),
  session_id  uuid not null references sessions(id) on delete cascade,
  amount_inr  numeric(10,2) not null,
  method      text not null default 'upi_intent',  -- upi_intent | razorpay | cash
  status      text not null default 'pending'
              check (status in ('pending','confirmed','failed')),
  reference   text,                                 -- gateway payment id / staff note
  created_at  timestamptz not null default now()
);

create index if not exists idx_menu_items_restaurant on menu_items(restaurant_id, category_id, sort_order);
create index if not exists idx_orders_session on orders(session_id);
create index if not exists idx_sessions_table on sessions(table_id) where status = 'active';

-- Row Level Security: customer browser (anon key) may read the menu; everything
-- else goes through the server with the service-role key.
alter table restaurants     enable row level security;
alter table tables          enable row level security;
alter table menu_categories enable row level security;
alter table menu_items      enable row level security;
alter table sessions        enable row level security;
alter table orders          enable row level security;
alter table order_items     enable row level security;
alter table payments        enable row level security;

create policy "public can read restaurants"     on restaurants     for select using (true);
create policy "public can read tables"          on tables          for select using (true);
create policy "public can read menu categories" on menu_categories for select using (true);
create policy "public can read menu items"      on menu_items      for select using (true);
-- sessions/orders/order_items/payments: no anon policies — service-role only.

-- Kitchen dashboard live updates
alter publication supabase_realtime add table orders;

-- ============================================================
-- v2 additions (applied to the live project; needed for fresh installs)
-- ============================================================

alter table restaurants
  add column if not exists payment_timing text not null default 'post'
    check (payment_timing in ('pre','post')),
  add column if not exists admin_pin text not null default '0000', -- change on first login
  add column if not exists gemini_api_key text,
  add column if not exists sarvam_api_key text,
  add column if not exists comp_item_id uuid references menu_items(id);

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
  add column if not exists discount_pct int not null default 0
    check (discount_pct between 0 and 50),
  add column if not exists comp_awarded boolean not null default false;

alter table orders add column if not exists placed_by text;

alter table order_items add column if not exists status text not null default 'queued'
  check (status in ('queued','preparing','served'));

create table if not exists waiter_calls (
  id            uuid primary key default gen_random_uuid(),
  table_id      uuid not null references tables(id) on delete cascade,
  restaurant_id uuid not null references restaurants(id) on delete cascade,
  status        text not null default 'open' check (status in ('open','done')),
  created_at    timestamptz not null default now()
);
alter table waiter_calls enable row level security;
create index if not exists idx_waiter_calls_open on waiter_calls(table_id) where status = 'open';

create table if not exists staff (
  id            uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references restaurants(id) on delete cascade,
  name          text not null,
  role          text not null check (role in ('admin','kitchen','waiter','reception')),
  pin           text not null,
  active        boolean not null default true,
  created_at    timestamptz not null default now()
);
alter table staff enable row level security;
create unique index if not exists idx_staff_pin on staff(restaurant_id, pin);

-- one active session per table (order/reward races resolve on this)
create unique index if not exists uniq_active_session_per_table
  on sessions(table_id) where status = 'active';

-- customer role must not read credentials or keys
revoke select on table restaurants from anon;
grant select (id, name, slug, currency, upi_vpa, payment_timing, created_at)
  on table restaurants to anon;
revoke select on table restaurants from authenticated;
grant select (id, name, slug, currency, upi_vpa, payment_timing, created_at)
  on table restaurants to authenticated;
