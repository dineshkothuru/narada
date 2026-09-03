-- Catch docs/schema.sql up with columns already live on the Supabase database.
-- Run this ONCE, after docs/migrate-i18n-columns.sql and
-- docs/migrate-outlet-rename.sql, on any DB created before 2026-09-03.
-- Fresh installs use docs/schema.sql (already includes these) and skip this file.

begin;

-- outlets: billing settings the admin screen writes and the bill reads
alter table outlets
  add column if not exists service_charge_pct numeric(5,2) not null default 0, -- admin/settings/route.ts, lib/billing.ts: outlet-wide service charge
  add column if not exists gstin text,                                        -- admin/settings/route.ts, lib/billing.ts: printed on the bill
  add column if not exists bill_seq int not null default 0;                    -- lib/billing.ts: monotonic per-outlet invoice counter

-- tables: floor plan + waiter/reception metadata
alter table tables
  add column if not exists ui_variant text not null default 'classic',         -- admin/tables/route.ts, lib/menu.ts: 'classic' | 'stories' customer UI
  add column if not exists capacity int not null default 4,                    -- admin/tables, waiter, floor: seat count
  add column if not exists zone text,                                          -- floor/route.ts: floor-plan grouping
  add column if not exists needs_cleaning boolean not null default false;      -- waiter/floor/lib/settle.ts: turnover flag after a table is cleared

alter table tables drop constraint if exists tables_ui_variant_check;
alter table tables add constraint tables_ui_variant_check
  check (ui_variant in ('classic','stories'));

-- menu_categories: food vs. drink split (kitchen vs. bar routing)
alter table menu_categories
  add column if not exists kind text not null default 'food';                  -- admin/categories, lib/menu.ts, lib/anna.ts: 'food' | 'drink'

alter table menu_categories drop constraint if exists menu_categories_kind_check;
alter table menu_categories add constraint menu_categories_kind_check
  check (kind in ('food','drink'));

-- menu_items: GST rate frozen onto order_items at order time
alter table menu_items
  add column if not exists gst_pct numeric(5,2) not null default 5;            -- order/route.ts, admin/menu, lib/billing(-math).ts: per-item GST rate

-- sessions: table-visit metadata, service charge waiver, and the frozen bill
alter table sessions
  add column if not exists guests int,                                        -- waiter/floor/lib/settle.ts: party size
  add column if not exists attendant text,                                    -- waiter/floor/counter, lib/settle.ts, lib/tips.ts, lib/billing.ts: waiter who claimed the table
  add column if not exists merged_into uuid references sessions(id),          -- floor/counter/lib/settle.ts: primary session of a merged group
  add column if not exists service_waived boolean not null default false,     -- bill/counter/lib/billing.ts: service charge waived on request
  add column if not exists bill_no text,                                      -- waiter/floor/counter, lib/settle.ts, lib/billing.ts: minted once, at bill time
  add column if not exists bill_gross numeric(10,2),                          -- lib/billing.ts: frozen totals, at bill time
  add column if not exists bill_discount numeric(10,2),                       -- lib/billing.ts
  add column if not exists bill_gst numeric(10,2),                            -- lib/billing.ts
  add column if not exists bill_service numeric(10,2),                        -- lib/billing.ts
  add column if not exists bill_tip numeric(10,2),                            -- bill/route.ts, lib/tips(-server).ts, lib/settle.ts, lib/billing.ts
  add column if not exists bill_net numeric(10,2),                            -- lib/settle.ts, lib/billing.ts
  add column if not exists tip_to text,                                       -- lib/tips(-server).ts, lib/settle.ts, lib/billing.ts: attendant frozen at bill time
  add column if not exists settled_at timestamptz;                            -- lib/tips.ts, lib/billing.ts, lib/tips-server.ts

-- orders: customer's chosen UI language, for kitchen/waiter display
alter table orders
  add column if not exists lang text;                                         -- order/voice/waiter/floor/kitchen/anna route.ts, lib/anna.ts: en | hi | te

-- order_items: GST rate frozen from the menu item at order time
alter table order_items
  add column if not exists gst_pct numeric(5,2) not null default 5;           -- order/route.ts, admin/menu, lib/billing(-math).ts

-- waiter_calls: acknowledgement trail so the alert bar can clear per-caller
alter table waiter_calls
  add column if not exists acked_at timestamptz,                              -- waiter/route.ts
  add column if not exists acked_by text;                                     -- waiter/route.ts

-- kitchen/waiter screens move items through a 'ready' state the original
-- check constraints (placed/preparing/served and queued/preparing/served)
-- don't allow; widen both to match kitchen/route.ts.
alter table orders drop constraint if exists orders_status_check;
alter table orders add constraint orders_status_check
  check (status in ('placed','preparing','ready','served','cancelled'));

alter table order_items drop constraint if exists order_items_status_check;
alter table order_items add constraint order_items_status_check
  check (status in ('queued','preparing','ready','served'));

-- live code only ever writes upi_intent | cash | card (never the schema
-- comment's "razorpay"); re-add the constraint dropped for pglite so a fresh
-- install and a migrated install enforce the same values.
alter table payments drop constraint if exists payments_method_check;
alter table payments add constraint payments_method_check
  check (method in ('upi_intent','cash','card'));

commit;
