import {
  deriveOrderStatus,
  guestMayRemove,
  orderToken,
  sanitizeCartLines,
  staffMayVoid,
  validItemIds,
  type CartLine,
} from "@narada/shared";
import { badRequest, conflict, notFound } from "../lib/http.js";
import type { Repos } from "../repositories/index.js";
import { getOrCreateSession, lookupTable } from "./tableSession.js";

// Port of web/app/api/order/route.ts POST + GET.

type OrderRepos = Pick<
  Repos,
  "tables" | "sessions" | "menuItems" | "orders" | "orderItems" | "outlets"
>;

type CancelOrderRepos = Pick<Repos, "orderItems" | "orders" | "audit">;

export type CancelOrderActor =
  | { kind: "customer"; outletId: string; sessionId: string }
  | {
      kind: "staff";
      outletId: string;
      staffId: string;
      role: string;
      actorName: string;
      reason?: string;
    };

export async function cancelOrderItem(
  repos: CancelOrderRepos,
  itemId: string,
  actor: CancelOrderActor,
): Promise<{ ok: true; orderStatus: string; orderCancelled: boolean; name: string }> {
  const item = await repos.orderItems.findForCancellation(itemId, actor.outletId);
  if (!item || (actor.kind === "customer" && item.session_id !== actor.sessionId)) {
    throw notFound("not found");
  }
  if (item.bill_no) throw conflict("bill already raised");

  const allowed =
    actor.kind === "customer" ? guestMayRemove(item.status) : staffMayVoid(item.status);
  if (!allowed || item.order_status === "cancelled") {
    throw conflict("item cannot be cancelled");
  }

  const cancelled = await repos.orderItems.cancel(
    itemId,
    actor.kind === "staff" ? actor.actorName : "guest",
    actor.outletId,
    {
      sessionId: actor.kind === "customer" ? actor.sessionId : undefined,
      statuses: actor.kind === "customer" ? ["queued"] : ["queued", "preparing", "ready"],
    },
  );
  if (!cancelled) throw conflict("item cannot be cancelled");

  const orderStatus =
    cancelled.orderStatus ??
    deriveOrderStatus(await repos.orderItems.listStatusesByOrder(item.order_id, actor.outletId));
  if (!cancelled.orderStatus)
    await repos.orders.setStatus(item.order_id, orderStatus, actor.outletId);
  try {
    await repos.audit.create({
      outlet_id: actor.outletId,
      staff_id: actor.kind === "staff" ? actor.staffId : null,
      role: actor.kind === "staff" ? actor.role : "customer",
      actor_name: actor.kind === "staff" ? actor.actorName : "guest",
      action: "item_cancelled",
      entity_type: "order_item",
      entity_id: itemId,
      details: {
        orderId: item.order_id,
        sessionId: item.session_id,
        itemName: item.name,
        reason: actor.kind === "staff" ? (actor.reason ?? null) : null,
      },
    });
  } catch {
    // Cancellation committed; do not make the client retry a successful write.
  }
  return {
    ok: true,
    orderStatus,
    orderCancelled: orderStatus === "cancelled",
    name: cancelled.name,
  };
}

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
    tableCode?: string;
    sessionId?: string;
    outletId?: string;
    cart: CartLine[];
    placedVia?: "ui" | "anna" | "waiter";
    guestName?: string;
    lang?: string;
  },
): Promise<PlaceOrderResult> {
  const ids = validItemIds(input.cart);
  if (ids.length === 0) throw badRequest("no valid items");

  let outletId: string;
  let tableLabel = "Takeaway";
  let session: { id: string; discount_pct: number; comp_awarded: boolean };
  if (input.sessionId && input.outletId) {
    const found = await repos.sessions.findById(input.sessionId, input.outletId);
    if (!found || found.status !== "active") throw notFound("unknown session");
    if (found.bill_no) throw conflict("bill already raised");
    outletId = input.outletId;
    session = found;
    if (found.table_id) {
      const table = await repos.tables.findById(found.table_id, outletId);
      tableLabel = table?.label ?? "Dine-in";
    }
  } else if (input.tableCode) {
    const table = await lookupTable(repos, input.tableCode, input.outletId);
    if (!table) throw notFound("unknown table");
    outletId = table.outlet_id;
    session = await getOrCreateSession(repos, table);
    const current = await repos.sessions.findById(session.id, outletId);
    if (current?.bill_no) throw conflict("bill already raised");
    tableLabel = table.label;
  } else {
    throw badRequest("customer session required");
  }

  const items = await repos.menuItems.findPricesByIds(outletId, ids);
  const byId = new Map(items.map((i) => [i.id, i]));
  const lines = sanitizeCartLines(input.cart, new Set(byId.keys()));
  if (lines.length === 0) throw badRequest("no valid items");

  const total = lines.reduce((s, l) => s + Number(byId.get(l.itemId)!.price_inr) * l.qty, 0);

  const order = await repos.orders.createWithItems(
    {
      session_id: session.id,
      outlet_id: outletId,
      total_inr: total,
      placed_via:
        input.placedVia === "anna" ? "anna" : input.placedVia === "waiter" ? "waiter" : "ui",
      placed_by:
        typeof input.guestName === "string" && input.guestName.trim()
          ? input.guestName.trim().slice(0, 40)
          : null,
      lang: ["en", "hi", "te"].includes(input.lang ?? "") ? input.lang : null,
    },
    lines.map((l) => ({
      menu_item_id: l.itemId,
      name: byId.get(l.itemId)!.name,
      unit_price: byId.get(l.itemId)!.price_inr,
      gst_pct: Number(byId.get(l.itemId)!.gst_pct ?? 5),
      qty: l.qty,
      notes: l.notes ?? null,
    })),
    outletId,
  );
  if (!order) throw conflict("bill already raised");

  return {
    orderId: order.id,
    orderNo: orderToken(order.id),
    total,
    discountPct: Number(session.discount_pct ?? 0),
    sessionId: session.id,
    tableLabel,
  };
}

export type SessionOrdersResult = {
  rounds: {
    id: string;
    orderNo: string;
    status: string;
    total_inr: number;
    created_at: string;
    placed_by: string | null;
    items: { id: string; name: string; qty: number; status: string }[];
  }[];
  discountPct: number;
  sessionStatus: string;
};

// The whole table's live order view: every round with its kitchen status.
export async function getSessionOrders(
  repos: Pick<Repos, "orders" | "sessions" | "tables" | "outlets">,
  sessionId: string,
  tableCode?: string,
  outletId?: string,
): Promise<SessionOrdersResult> {
  let scopedOutletId = outletId;
  if (tableCode) {
    const table = await lookupTable(repos, tableCode, outletId);
    if (!table || !(await repos.sessions.findOwnedByTable(sessionId, table.id, table.outlet_id))) {
      throw notFound("not found");
    }
    scopedOutletId ??= table.outlet_id;
  }
  if (!scopedOutletId) throw notFound("not found");
  const session = await repos.sessions.findById(sessionId, scopedOutletId);
  if (!session) throw notFound("not found");
  const primaryId = await repos.sessions.findPrimaryId(sessionId, scopedOutletId);
  if (!primaryId) throw notFound("not found");
  const primary =
    primaryId === sessionId ? session : await repos.sessions.findById(primaryId, scopedOutletId);
  if (!primary) throw notFound("not found");
  const rows = await repos.orders.listBySessionWithItems(primaryId, scopedOutletId);
  return {
    rounds: rows
      .filter((o) => o.status !== "cancelled")
      .map((o) => ({
        id: o.id,
        orderNo: orderToken(o.id),
        status: o.status,
        total_inr: Number(o.total_inr),
        created_at: o.created_at,
        placed_by: o.placed_by,
        items: o.items.map((it) => ({ id: it.id, name: it.name, qty: it.qty, status: it.status })),
      })),
    discountPct: Number(primary.discount_pct ?? 0),
    sessionStatus: primary.status ?? "active",
  };
}

export async function getOrderStatus(
  repos: Pick<Repos, "orders" | "tables" | "outlets">,
  orderId: string,
  tableCode?: string,
  outletId?: string,
  sessionId?: string,
): Promise<{ status: string }> {
  let row;
  if (tableCode) {
    const table = await lookupTable(repos, tableCode, outletId);
    row = table ? await repos.orders.findStatusForTable(orderId, table.id, table.outlet_id) : null;
  } else if (outletId) {
    row = sessionId
      ? await repos.orders.findStatusForSession(orderId, sessionId, outletId)
      : await repos.orders.findStatus(orderId, outletId);
  }
  if (!row) throw notFound("not found");
  return { status: row.status };
}
