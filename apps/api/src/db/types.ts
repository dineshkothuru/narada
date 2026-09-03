import type { ColumnType, Generated } from "kysely";

// Hand-written from docs/schema.sql + docs/migrate-i18n-columns.sql.
// i18n jsonb columns were dropped by the migration; only the flat *_hi/*_te
// columns it left behind are modeled here.

export interface OutletsTable {
  id: Generated<string>;
  name: string;
  slug: string;
  upi_vpa: string | null;
  currency: Generated<string>;
  payment_timing: Generated<string>; // 'pre' | 'post'
  created_at: Generated<string>;
  admin_pin: Generated<string>;
  gemini_api_key: string | null;
  sarvam_api_key: string | null;
  comp_item_id: string | null;
}

export interface TablesTable {
  id: Generated<string>;
  outlet_id: string;
  label: string;
  code: string;
  created_at: Generated<string>;
}

export interface MenuCategoriesTable {
  id: Generated<string>;
  outlet_id: string;
  name: string;
  emoji: string | null;
  sort_order: Generated<number>;
  name_hi: string | null;
  name_te: string | null;
}

export interface MenuItemsTable {
  id: Generated<string>;
  outlet_id: string;
  category_id: string;
  name: string;
  description: string | null;
  price_inr: ColumnType<string, number | string, number | string>;
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
}

export interface SessionsTable {
  id: Generated<string>;
  table_id: string;
  outlet_id: string;
  status: Generated<string>; // active | billed | closed
  created_at: Generated<string>;
  closed_at: string | null;
  discount_pct: Generated<number>;
  comp_awarded: Generated<boolean>;
}

export interface OrdersTable {
  id: Generated<string>;
  session_id: string;
  outlet_id: string;
  status: Generated<string>; // placed | preparing | served | cancelled
  total_inr: ColumnType<string, number | string, number | string>;
  placed_via: Generated<string>; // ui | anna
  created_at: Generated<string>;
  placed_by: string | null;
}

export interface OrderItemsTable {
  id: Generated<string>;
  order_id: string;
  menu_item_id: string;
  name: string;
  unit_price: ColumnType<string, number | string, number | string>;
  qty: number;
  notes: string | null;
  status: Generated<string>; // queued | preparing | served
}

export interface PaymentsTable {
  id: Generated<string>;
  session_id: string;
  amount_inr: ColumnType<string, number | string, number | string>;
  method: Generated<string>; // upi_intent | razorpay | cash
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
}

export interface StaffTable {
  id: Generated<string>;
  outlet_id: string;
  name: string;
  role: string; // admin | kitchen | waiter | reception
  pin: string;
  active: Generated<boolean>;
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
}
