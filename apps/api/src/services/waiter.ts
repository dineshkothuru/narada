import { deriveTableStatus } from "@narada/shared";
import { HttpError, notFound } from "../lib/http.js";
import type { Repos } from "../repositories/index.js";
import { computeBill } from "./billing.js";
import { recordPayment, type PaymentInput } from "./settle.js";
import { updateItemStatus, updateWholeOrderStatus } from "./kitchen.js";

// Port of web/app/api/waiter/route.ts.

type WaiterBoardRepos = Pick<Repos, "tables" | "sessions" | "waiterCalls" | "outlets">;

export async function waiterBoard(repos: WaiterBoardRepos, outletId: string) {
  const [tables, sessions, calls] = await Promise.all([
    repos.tables.listAll(outletId),
    repos.sessions.listActiveForWaiter(outletId),
    repos.waiterCalls.listOpen(outletId),
  ]);

  const bills = new Map<string, Awaited<ReturnType<typeof computeBill>>>();
  for (const s of sessions) {
    try {
      bills.set(s.id, await computeBill(repos, s.id, undefined, outletId));
    } catch {
      // a session mid-write (e.g. no orders yet) just has no bill to show
    }
  }

  const byTable = tables.map((t) => {
    const session = sessions.find((s) => s.table_id === t.id) ?? null;
    const ordered = session
      ? session.orders
          .filter((o) => o.status !== "cancelled")
          .reduce((sum, o) => sum + Number(o.total_inr), 0)
      : 0;
    const paid = session
      ? session.payments
          .filter((p) => p.status === "confirmed")
          .reduce((sum, p) => sum + Number(p.amount_inr), 0)
      : 0;
    const bill = session ? bills.get(session.id) : undefined;
    const due = Math.max(0, (bill?.net ?? ordered) - paid);

    return {
      tableId: t.id,
      label: t.label,
      code: t.code,
      capacity: t.capacity,
      call: calls.find((c) => c.table_id === t.id) ?? null,
      needsCleaning: t.needs_cleaning,
      session: session
        ? {
            id: session.id,
            since: session.created_at,
            guests: session.guests,
            status: deriveTableStatus({
              hasSession: true,
              needsCleaning: false,
              rounds: session.orders.filter((o) => o.status !== "cancelled").length,
              pending: session.orders.filter(
                (o) => o.status !== "cancelled" && o.status !== "served",
              ).length,
              due,
              billRaised: Boolean(session.bill_no),
            }),
            orders: session.orders.map((order) => ({
              ...order,
              items: order.items.map((item) => {
                const row = item as typeof item & { id?: string; status?: string };
                return { ...item, id: row.id ?? null, status: row.status ?? "queued" };
              }),
            })),
            ordered,
            paid,
            discountPct: session.discount_pct,
            gst: bill?.gst ?? 0,
            service: bill?.service ?? 0,
            serviceWaived: bill?.serviceWaived ?? false,
            attendant: session.attendant,
            billNo: session.bill_no,
            langs: [
              ...new Set(session.orders.map((o) => o.lang).filter((l): l is string => Boolean(l))),
            ],
            due,
          }
        : null,
    };
  });

  const liveOrderCount = (table: (typeof byTable)[number]) =>
    table.session?.orders.filter((order) => order.status !== "cancelled").length ?? 0;
  const active = byTable.filter((table) => table.session);
  return {
    tables: byTable,
    waitingToOrder: active
      .filter((table) => liveOrderCount(table) === 0)
      .sort((a, b) => Date.parse(a.session!.since) - Date.parse(b.session!.since)),
    running: active.filter((table) => liveOrderCount(table) > 0),
  };
}

type AckCallRepos = Pick<Repos, "waiterCalls" | "sessions">;

// Acking a call and claiming the table are two separate writes: the ack
// always happens, and the claim only wins if nobody already has the table.
export async function ackCall(
  repos: AckCallRepos,
  input: { callId: string; attendedBy?: string; sessionId?: string },
  outletId: string,
  displayName?: string,
): Promise<{ ok: true }> {
  let call: { id: string; table_id: string } | null = null;
  call = await repos.waiterCalls.findOpenById(input.callId, outletId);
  if (!call) throw notFound("unknown call");
  const attendedBy = displayName?.trim().slice(0, 40) || null;

  if (input.sessionId) {
    const session = await repos.sessions.findById(input.sessionId, outletId);
    if (!session || (call && session.table_id !== call.table_id)) {
      throw notFound("unknown session");
    }
  }

  await repos.waiterCalls.ack(input.callId, new Date().toISOString(), attendedBy, outletId);

  if (attendedBy && input.sessionId) {
    await repos.sessions.claimWaiter(input.sessionId, attendedBy, outletId);
  }
  return { ok: true };
}

type MarkServedRepos = Pick<Repos, "orders" | "orderItems"> & {
  transaction?: Repos["transaction"];
};

export async function markServed(
  repos: MarkServedRepos,
  orderId: string,
  outletId: string,
): Promise<{ ok: true }> {
  await updateWholeOrderStatus(repos, orderId, "served", outletId);
  return { ok: true };
}

export async function markItemServed(
  repos: Pick<Repos, "orders" | "orderItems"> & { transaction?: Repos["transaction"] },
  itemId: string,
  outletId: string,
): Promise<{ ok: true; orderStatus: string }> {
  const found = await repos.orderItems.findForServing(itemId, outletId);
  if (!found) throw notFound("unknown item");
  if (found.status !== "ready") throw new HttpError(409, "item is not ready to serve");
  return updateItemStatus(repos, itemId, "served", outletId);
}

export async function clearTable(
  repos: Pick<Repos, "tables" | "waiterCalls">,
  tableId: string,
  outletId: string,
): Promise<{ ok: true }> {
  if (!(await repos.tables.findById(tableId, outletId))) {
    throw notFound("unknown table");
  }
  await repos.tables.setNeedsCleaning([tableId], false, outletId);
  await repos.waiterCalls.closeOpenByTables([tableId], "table cleared", outletId);
  return { ok: true };
}

type WaiterPaymentRepos = Pick<Repos, "sessions" | "outlets" | "payments" | "tables" | "audit">;

export async function waiterRecordPayment(
  repos: WaiterPaymentRepos,
  input: PaymentInput,
  outletId: string,
  displayName?: string,
  actor?: { staffId?: string | null; role?: string; actorName?: string },
) {
  return recordPayment(repos, input, outletId, displayName, actor);
}
