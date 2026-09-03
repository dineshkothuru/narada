import { z } from "zod";

// A cart line as the customer app sends it. qty/itemId get their own
// sanitisation pass in the order service (@narada/shared cart helpers) —
// this schema just enforces shape, not the uuid/qty-range rules.
export const cartLineSchema = z.object({
  itemId: z.string(),
  qty: z.number(),
  notes: z.string().optional(),
});

export const placeOrderSchema = z.object({
  tableCode: z.string().min(1, "tableCode and cart required"),
  cart: z.array(cartLineSchema).min(1, "tableCode and cart required"),
  placedVia: z.enum(["ui", "anna"]).optional(),
  guestName: z.string().optional(),
  lang: z.string().optional(),
});
export type PlaceOrderInput = z.infer<typeof placeOrderSchema>;

export type PlaceOrderResponse = {
  orderId: string;
  orderNo: string;
  total: number;
  discountPct: number;
  sessionId: string;
  tableLabel: string;
};

// GET /api/order — either ?session=<id> (whole table view) or ?id=<orderId>
// (single order status poll). At least one of the two must be present.
export const orderQuerySchema = z.object({
  id: z.string().optional(),
  session: z.string().optional(),
});
export type OrderQuery = z.infer<typeof orderQuerySchema>;

export type OrderRoundItem = { name: string; qty: number; status: string };
export type OrderRound = {
  id: string;
  status: string;
  total_inr: number;
  created_at: string;
  placed_by: string | null;
  items: OrderRoundItem[];
};

export type SessionOrdersResponse = {
  rounds: OrderRound[];
  discountPct: number;
  sessionStatus: string;
};

export type OrderStatusResponse = { status: string };
