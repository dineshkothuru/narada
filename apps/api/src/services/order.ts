import { sanitizeCartLines, validItemIds, type CartLine } from "@narada/shared";
import { badRequest, notFound } from "../lib/http.js";
import type { Repos } from "../repositories/index.js";
import { getOrCreateSession, lookupTable } from "./tableSession.js";

// Port of web/app/api/order/route.ts POST + GET.

type OrderRepos = Pick<Repos, "tables" | "sessions" | "menuItems" | "orders" | "orderItems">;

export type PlaceOrderResult = {
  orderId: string;
  orderNo: string;
  total: number;
  discountPct: number;
  sessionId: string;
  tableLabel: string;
};

export async function placeOrder(
  repos: OrderRepos,
  input: {
    tableCode: string;
    cart: CartLine[];
    placedVia?: "ui" | "anna";
    guestName?: string;
    lang?: string;
  },
): Promise<PlaceOrderResult> {
  const ids = validItemIds(input.cart);
  if (ids.length === 0) throw badRequest("no valid items");

  const table = await lookupTable(repos, input.tableCode);
  if (!table) throw notFound("unknown table");

  const [session, items] = await Promise.all([
    getOrCreateSession(repos, table),
    repos.menuItems.findPricesByIds(table.outlet_id, ids),
  ]);
  const byId = new Map(items.map((i) => [i.id, i]));
  const lines = sanitizeCartLines(input.cart, new Set(byId.keys()));
  if (lines.length === 0) throw badRequest("no valid items");

  const total = lines.reduce((s, l) => s + Number(byId.get(l.itemId)!.price_inr) * l.qty, 0);

  const order = await repos.orders.create({
    session_id: session.id,
    outlet_id: table.outlet_id,
    total_inr: total,
    placed_via: input.placedVia === "anna" ? "anna" : "ui",
    placed_by:
      typeof input.guestName === "string" && input.guestName.trim()
        ? input.guestName.trim().slice(0, 40)
        : null,
    lang: ["en", "hi", "te"].includes(input.lang ?? "") ? input.lang : null,
  });

  await repos.orderItems.createMany(
    lines.map((l) => ({
      order_id: order.id,
      menu_item_id: l.itemId,
      name: byId.get(l.itemId)!.name,
      unit_price: byId.get(l.itemId)!.price_inr,
      gst_pct: Number(byId.get(l.itemId)!.gst_pct ?? 5),
      qty: l.qty,
      notes: l.notes ?? null,
    })),
  );

  return {
    orderId: order.id,
    orderNo: order.id.slice(0, 8).toUpperCase(),
    total,
    discountPct: Number(session.discount_pct ?? 0),
    sessionId: session.id,
    tableLabel: table.label,
  };
}

export type SessionOrdersResult = {
  rounds: {
    id: string;
    status: string;
    total_inr: number;
    created_at: string;
    placed_by: string | null;
    items: { name: string; qty: number; status: string }[];
  }[];
  discountPct: number;
  sessionStatus: string;
};

// The whole table's live order view: every round with its kitchen status.
export async function getSessionOrders(
  repos: Pick<Repos, "orders" | "sessions">,
  sessionId: string,
): Promise<SessionOrdersResult> {
  const [rows, session] = await Promise.all([
    repos.orders.listBySessionWithItems(sessionId),
    repos.sessions.findById(sessionId),
  ]);
  return {
    rounds: rows
      .filter((o) => o.status !== "cancelled")
      .map((o) => ({
        id: o.id,
        status: o.status,
        total_inr: Number(o.total_inr),
        created_at: o.created_at,
        placed_by: o.placed_by,
        items: o.items.map((it) => ({ name: it.name, qty: it.qty, status: it.status })),
      })),
    discountPct: Number(session?.discount_pct ?? 0),
    sessionStatus: session?.status ?? "active",
  };
}

export async function getOrderStatus(
  repos: Pick<Repos, "orders">,
  orderId: string,
): Promise<{ status: string }> {
  const row = await repos.orders.findStatus(orderId);
  if (!row) throw notFound("not found");
  return { status: row.status };
}
