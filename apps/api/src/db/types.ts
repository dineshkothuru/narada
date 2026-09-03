import type { ColumnType, Generated } from "kysely";

// Hand-written from docs/schema.sql + docs/migrate-i18n-columns.sql +
// docs/migrate-outlet-rename.sql (table `outlets`, column `outlet_id`), and
// from the columns web/app/api/**/route.ts actually reads and writes against
// the live database. Several of those columns post-date docs/schema.sql —
// they are marked LIVE below and are created by tests/helpers/schema.ts so the
// pglite repository tests run against the same shape as production.
//
// i18n jsonb columns were dropped by the migration; only the flat *_hi/*_te
// columns it left behind are modeled here.

// numeric(10,2) comes back from node-postgres as a string; every read site
// wraps it in Number(), so the select type stays string on purpose.
type Numeric = ColumnType<string, number | string, number | string>;

export interface OutletsTable {
  id: Generated<string>;
  name: string;
  slug: string;
  upi_vpa: string | null;
  currency: Generated<string>;
  tables_enabled: Generated<boolean>;
  payment_timing: Generated<string>; // 'pre' | 'post'
  active: Generated<boolean>;
  created_at: Generated<string>;
  gemini_api_key: string | null;
  sarvam_api_key: string | null;
  comp_item_id: string | null;
  service_charge_pct: Generated<number>; // LIVE
  gstin: string | null; // LIVE
  bill_seq: Generated<number>; // LIVE — monotonic invoice counter
}

export interface TablesTable {
  id: Generated<string>;
  outlet_id: string;
  label: string;
  code: string;
  created_at: Generated<string>;
  ui_variant: Generated<string>; // LIVE — 'classic' | 'stories'
  capacity: Generated<number>; // LIVE
  zone: string | null; // LIVE
  needs_cleaning: Generated<boolean>; // LIVE
}

export interface MenuCategoriesTable {
  id: Generated<string>;
  outlet_id: string;
  name: string;
  emoji: string | null;
  sort_order: Generated<number>;
  name_hi: string | null;
  name_te: string | null;
  kind: Generated<string>; // LIVE — 'food' | 'drink'
}

export interface MenuItemsTable {
  id: Generated<string>;
  outlet_id: string;
  category_id: string;
  name: string;
  description: string | null;
  price_inr: Numeric;
  is_veg: Generated<boolean>;
  spice_level: Generated<number>;
  allergens: Generated<string[]>;
  tags: Generated<string[]>;
  image_url: string | null;
  is_available: Generated<boolean>;
  sort_order: Generated<number>;
  name_hi: string | null;
  name_te: string | null;
  description_hi: string | null;
  description_te: string | null;
  emoji: string | null;
  gst_pct: Generated<number>; // LIVE — per-item GST rate
}

export interface SessionsTable {
  id: Generated<string>;
  table_id: string | null;
  outlet_id: string;
  customer_id: Generated<string | null>;
  service_type: Generated<string>; // dine_in | takeaway
  status: Generated<string>; // active | billed | closed
  created_at: Generated<string>;
  closed_at: string | null;
  discount_pct: Generated<number>;
  comp_awarded: Generated<boolean>;
  guests: number | null; // LIVE
  attendant: string | null; // LIVE — waiter who claimed the table
  merged_into: string | null; // LIVE — primary session of a merged group
  service_waived: Generated<boolean>; // LIVE
  bill_no: string | null; // LIVE — minted once, at bill time
  bill_gross: Numeric | null; // LIVE
  bill_discount: Numeric | null; // LIVE
  bill_gst: Numeric | null; // LIVE
  bill_service: Numeric | null; // LIVE
  bill_tip: Numeric | null; // LIVE
  bill_net: Numeric | null; // LIVE
  tip_to: string | null; // LIVE — attendant frozen at bill time
  settled_at: string | null; // LIVE
}

export interface OrdersTable {
  id: Generated<string>;
  session_id: string;
  outlet_id: string;
  status: Generated<string>; // placed | preparing | ready | served | cancelled
  total_inr: Numeric;
  placed_via: Generated<string>; // ui | anna
  created_at: Generated<string>;
  placed_by: string | null;
  lang: string | null; // LIVE — en | hi | te
}

export interface OrderItemsTable {
  id: Generated<string>;
  order_id: string;
  menu_item_id: string;
  name: string;
  unit_price: Numeric;
  qty: number;
  notes: string | null;
  status: Generated<string>; // queued | preparing | ready | served | cancelled
  gst_pct: Generated<number>; // LIVE — frozen from the menu item
  cancelled_at: string | null;
  cancelled_by: string | null;
}

export interface PaymentsTable {
  id: Generated<string>;
  session_id: string;
  amount_inr: Numeric;
  method: Generated<string>; // upi_intent | card | cash
  status: Generated<string>; // pending | confirmed | failed
  reference: string | null;
  created_at: Generated<string>;
}

export interface WaiterCallsTable {
  id: Generated<string>;
  table_id: string;
  outlet_id: string;
  status: Generated<string>; // open | done
  created_at: Generated<string>;
  acked_at: string | null; // LIVE
  acked_by: string | null; // LIVE
}

export interface StaffTable {
  id: Generated<string>;
  outlet_id: string;
  username: string | null;
  first_name: string | null;
  last_name: string | null;
  role: string; // admin | kitchen | waiter | reception | cashier
  password_hash: string | null;
  active: Generated<boolean>;
  created_at: Generated<string>;
}

export interface CustomersTable {
  id: Generated<string>;
  phone: string;
  first_name: string;
  last_name: string | null;
  password_hash: string;
  active: Generated<boolean>;
  created_at: Generated<string>;
}

export interface AuditLogTable {
  id: Generated<string>;
  outlet_id: string;
  staff_id: string | null;
  role: string | null;
  actor_name: string | null;
  action: string;
  entity_type: string;
  entity_id: string | null;
  details: unknown;
  created_at: Generated<string>;
}

export interface DB {
  outlets: OutletsTable;
  tables: TablesTable;
  menu_categories: MenuCategoriesTable;
  menu_items: MenuItemsTable;
  sessions: SessionsTable;
  orders: OrdersTable;
  order_items: OrderItemsTable;
  payments: PaymentsTable;
  waiter_calls: WaiterCallsTable;
  staff: StaffTable;
  customers: CustomersTable;
  audit_log: AuditLogTable;
}
