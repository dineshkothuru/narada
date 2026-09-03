import { z } from "zod";

// GET /api/admin/orders?range=today|week|all
export const adminOrdersQuerySchema = z.object({
  range: z.enum(["today", "week", "all"]).optional(),
});
export type AdminOrdersQuery = z.infer<typeof adminOrdersQuerySchema>;

export type AdminOrderRow = {
  id: string;
  status: string;
  total_inr: number;
  placed_via: string;
  placed_by: string | null;
  created_at: string;
  session: {
    id: string;
    status: string;
    discount_pct: number;
    table: { label: string } | null;
    payments: { amount_inr: number; status: string; method: string }[];
  } | null;
  items: { name: string; qty: number; unit_price: number; status: string }[];
};

export type AdminOrdersResponse = {
  orders: AdminOrderRow[];
  stats: {
    orders: number;
    tables: number;
    gross: number;
    netExpected: number;
    collected: number;
    outstanding: number;
    byVoice: number;
    avgTable: number;
    topDishes: { name: string; qty: number }[];
  };
};
