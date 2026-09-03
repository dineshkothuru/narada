import "server-only";
import { sbFetch } from "./supabase-server";
import { deriveOrderStatus } from "./status";
import { guestMayRemove, staffMayVoid } from "./cancel-rules";

// A dish can be taken off the bill only while the kitchen has not started it.
// Once it is being cooked the food exists and somebody is paying for it, so the
// guest cannot remove it — a waiter can still void it, but that is a deliberate
// staff decision, recorded, not a self-service undo.

export type CancelOutcome =
  | { ok: true; orderStatus: string; orderCancelled: boolean; name: string }
  | { error: string; status: number };

export async function cancelItem(opts: {
  itemId: string;
  by: string;
  /** guests may only remove what the kitchen has not started */
  guest: boolean;
  /** when a guest asks, the item must belong to their table */
  tableId?: string;
}): Promise<CancelOutcome> {
  const rows = await sbFetch<
    {
      id: string;
      name: string;
      status: string;
      order_id: string;
      order: { session: { table_id: string; bill_no: string | null } | null } | null;
    }[]
  >(
    `order_items?select=id,name,status,order_id,order:orders(session:sessions(table_id,bill_no))` +
      `&id=eq.${encodeURIComponent(opts.itemId)}&limit=1`,
  );
  if (rows.length === 0) return { error: "unknown item", status: 404 };
  const item = rows[0];

  if (opts.guest && opts.tableId && item.order?.session?.table_id !== opts.tableId) {
    return { error: "not your table", status: 403 };
  }
  if (item.status === "cancelled") return { error: "already removed", status: 409 };
  if (item.order?.session?.bill_no) {
    // the invoice is frozen; changing it now would not match what was printed
    return { error: "the bill has already been raised — ask the counter", status: 409 };
  }
  if (opts.guest && !guestMayRemove(item.status)) {
    return {
      error: "the kitchen has already started this — please ask your waiter",
      status: 409,
    };
  }
  if (!staffMayVoid(item.status)) {
    return { error: "this has already been served", status: 409 };
  }

  await sbFetch(`order_items?id=eq.${encodeURIComponent(opts.itemId)}`, {
    method: "PATCH",
    body: JSON.stringify({
      status: "cancelled",
      cancelled_at: new Date().toISOString(),
      cancelled_by: opts.by.slice(0, 60),
    }),
  });

  // the round follows its remaining dishes; if nothing is left, it is void
  const siblings = await sbFetch<{ status: string }[]>(
    `order_items?select=status&order_id=eq.${encodeURIComponent(item.order_id)}`,
  );
  const live = siblings.filter((s) => s.status !== "cancelled");
  const orderStatus = live.length === 0 ? "cancelled" : deriveOrderStatus(live);
  await sbFetch(`orders?id=eq.${encodeURIComponent(item.order_id)}`, {
    method: "PATCH",
    body: JSON.stringify({ status: orderStatus }),
  });

  return {
    ok: true,
    orderStatus,
    orderCancelled: live.length === 0,
    name: item.name,
  };
}
