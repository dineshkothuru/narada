import { conflict, notFound } from "../lib/http.js";
import type { Repos } from "../repositories/index.js";
import { finalizeBill } from "./billing.js";

// Port of web/lib/settle.ts. The legacy functions returned {error, status}
// objects that every caller re-wrapped; here they throw HttpError with the same
// status and message, which the app's error handler turns into the same JSON.
//
// Two separate steps, because they happen in different places.
//
// Raising the bill is the counter's job: it freezes the totals and mints the
// invoice number, and must happen exactly once. Collecting the money happens
// wherever the guest is — UPI at the table, cash to a waiter, or card at the
// counter — so any staff member can record a payment against a raised bill.

type SettleRepos = Pick<Repos, "sessions" | "outlets" | "payments" | "tables" | "audit"> & {
  waiterCalls?: Pick<Repos["waiterCalls"], "closeOpenByTables">;
};

// Raised without a tip: nobody knows it yet. Whatever the guest pays above the
// bill becomes the tip when the payment is recorded.
export async function generateBill(
  repos: SettleRepos,
  sessionId: string,
  outletId: string,
  actor?: { staffId?: string | null; role?: string; actorName?: string },
) {
  const session = await repos.sessions.findById(sessionId, outletId);
  if (!session) throw notFound("unknown session");
  if (session.status !== "active") throw conflict("session is not active");
  if (session.bill_no) {
    // a double-tap at the counter must not mint a second invoice number
    throw conflict("bill already raised");
  }
  const bill = await finalizeBill(repos, sessionId, 0, outletId);
  try {
    await repos.audit.create({
      outlet_id: outletId,
      staff_id: actor?.staffId ?? null,
      role: actor?.role ?? "counter",
      actor_name: actor?.actorName ?? "counter",
      action: "bill_raised",
      entity_type: "session",
      entity_id: sessionId,
      details: { billNo: bill.billNo, net: bill.net },
    });
  } catch {
    // Bill finalization committed; an audit outage must not cause a retry.
  }
  return { ok: true as const, billNo: bill.billNo, net: bill.net };
}

export type PaymentInput = {
  sessionId: string;
  amount?: number;
  method?: "upi_intent" | "cash" | "card";
  utr?: string;
  collectedBy?: string | null;
};

export async function recordPayment(
  repos: SettleRepos,
  input: PaymentInput,
  outletId: string,
  displayName?: string,
  actor?: { staffId?: string | null; role?: string; actorName?: string },
) {
  const primaryId = await repos.sessions.findPrimaryId(input.sessionId, outletId);
  const session = primaryId ? await repos.sessions.findById(primaryId, outletId) : null;
  if (!session) throw notFound("unknown session");
  if (session.status !== "active") throw conflict("already closed");
  if (!session.bill_no) {
    // money must never be taken against totals that can still move
    throw conflict("no bill has been raised for this table yet");
  }

  const result = await repos.payments.recordConfirmed(
    {
      sessionId: primaryId!,
      amount: input.amount,
      method: input.method === "cash" ? "cash" : input.method === "card" ? "card" : "upi_intent",
      utr: input.utr,
      collector: displayName,
    },
    outletId,
  );
  if (!result) throw conflict("already closed");

  try {
    await repos.audit.create({
      outlet_id: outletId,
      staff_id: actor?.staffId ?? null,
      role: actor?.role ?? "counter",
      actor_name:
        actor?.actorName?.trim().slice(0, 40) || displayName?.trim().slice(0, 40) || "staff",
      action: "payment_recorded",
      entity_type: "session",
      entity_id: primaryId!,
      details: { amount: result.amount, tip: result.tip, method: input.method ?? "upi_intent" },
    });
  } catch {
    // Payment committed; do not turn a successful collection into a failure.
  }

  // part payments are allowed (a table splitting the bill), so the tab only
  // closes once nothing is left owing. The repository has already performed
  // the lock, payment insert, and primary close atomically.
  if (!result.closed) return { ok: true as const, due: result.due, closed: false as const };

  const closedAt = new Date().toISOString();

  // a merged group bills through its primary, so paying it closes the whole
  // group — otherwise the joined tables would sit "dining" forever
  const merged = await repos.sessions.listActiveMergedInto(primaryId!, outletId);
  if (merged.length > 0) {
    await repos.sessions.closeMergedInto(primaryId!, closedAt, outletId);
  }

  // the guests are still sitting there and the table needs wiping down — a
  // waiter hands it back once it is actually ready for the next party
  const tableIds = [result.tableId, ...merged.map((m) => m.table_id)].filter((id): id is string =>
    Boolean(id),
  );
  if (tableIds.length > 0) {
    await repos.tables.setNeedsCleaning(tableIds, true, outletId);
    await repos.waiterCalls?.closeOpenByTables(tableIds, "settled", outletId);
  }

  return { ok: true as const, due: 0, closed: true as const, billNo: result.billNo };
}
