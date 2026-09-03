import { deriveTableStatus } from "@narada/shared";
import type { Repos } from "../repositories/index.js";
import { computeBill } from "./billing.js";
import { recordPayment, type PaymentInput } from "./settle.js";

// Port of web/app/api/waiter/route.ts.

type WaiterBoardRepos = Pick<Repos, "tables" | "sessions" | "waiterCalls" | "outlets">;

export async function waiterBoard(repos: WaiterBoardRepos) {
  const [tables, sessions, calls] = await Promise.all([
    repos.tables.listAll(),
    repos.sessions.listActiveForWaiter(),
    repos.waiterCalls.listOpen(),
  ]);

  const bills = new Map<string, Awaited<ReturnType<typeof computeBill>>>();
  for (const s of sessions) {
    try {
      bills.set(s.id, await computeBill(repos, s.id));
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
            orders: session.orders,
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

  return { tables: byTable };
}

type AckCallRepos = Pick<Repos, "waiterCalls" | "sessions">;

// Acking a call and claiming the table are two separate writes: the ack
// always happens, and the claim only wins if nobody already has the table.
export async function ackCall(
  repos: AckCallRepos,
  input: { callId: string; attendedBy?: string; sessionId?: string },
): Promise<{ ok: true }> {
  const attendedBy = input.attendedBy?.trim() ? input.attendedBy.trim().slice(0, 40) : null;
  await repos.waiterCalls.ack(input.callId, new Date().toISOString(), attendedBy);

  if (attendedBy && input.sessionId) {
    await repos.sessions.claimWaiter(input.sessionId, attendedBy);
  }
  return { ok: true };
}

type MarkServedRepos = Pick<Repos, "orders" | "orderItems">;

export async function markServed(repos: MarkServedRepos, orderId: string): Promise<{ ok: true }> {
  await repos.orders.setStatus(orderId, "served");
  await repos.orderItems.setStatusByOrder(orderId, "served");
  return { ok: true };
}

export async function clearTable(
  repos: Pick<Repos, "tables">,
  tableId: string,
): Promise<{ ok: true }> {
  await repos.tables.setNeedsCleaning([tableId], false);
  return { ok: true };
}

type WaiterPaymentRepos = Pick<Repos, "sessions" | "outlets" | "payments" | "tables">;

export async function waiterRecordPayment(repos: WaiterPaymentRepos, input: PaymentInput) {
  return recordPayment(repos, input);
}
