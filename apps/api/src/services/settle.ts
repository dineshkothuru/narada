import { splitPayment } from "@narada/shared";
import { conflict, notFound } from "../lib/http.js";
import type { Repos } from "../repositories/index.js";
import { computeBill, finalizeBill } from "./billing.js";

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

type SettleRepos = Pick<Repos, "sessions" | "outlets" | "payments" | "tables">;

// Raised without a tip: nobody knows it yet. Whatever the guest pays above the
// bill becomes the tip when the payment is recorded.
export async function generateBill(repos: SettleRepos, sessionId: string) {
  const session = await repos.sessions.findById(sessionId);
  if (!session) throw notFound("unknown session");
  if (session.bill_no) {
    // a double-tap at the counter must not mint a second invoice number
    throw conflict("bill already raised");
  }
  const bill = await finalizeBill(repos, sessionId, 0, session.outlet_id);
  return { ok: true as const, billNo: bill.billNo, net: bill.net };
}

export type PaymentInput = {
  sessionId: string;
  amount?: number;
  method?: "upi_intent" | "cash" | "card";
  utr?: string;
  collectedBy?: string | null;
};

export async function recordPayment(repos: SettleRepos, input: PaymentInput) {
  const session = await repos.sessions.findById(input.sessionId);
  if (!session) throw notFound("unknown session");
  if (session.status !== "active") throw conflict("already closed");
  if (!session.bill_no) {
    // money must never be taken against totals that can still move
    throw conflict("no bill has been raised for this table yet");
  }

  const before = await computeBill(repos, input.sessionId);
  const dueBefore = Math.max(0, before.net - before.paid);
  const amount = typeof input.amount === "number" ? input.amount : dueBefore;
  const split = splitPayment(dueBefore, amount);

  // paying more than the bill is a tip, and it belongs to whoever served the
  // table — the frozen invoice grows by exactly that much
  if (split.tip > 0) {
    await repos.sessions.update(input.sessionId, {
      bill_tip: Math.round(before.tip + split.tip),
      bill_net: Math.round(before.net + split.tip),
      tip_to: session.tip_to ?? session.attendant ?? null,
    });
  }

  await repos.payments.create({
    session_id: input.sessionId,
    amount_inr: amount,
    method: input.method === "cash" ? "cash" : input.method === "card" ? "card" : "upi_intent",
    status: "confirmed",
    reference: [
      session.bill_no,
      split.tip > 0 ? `incl. tip ₹${split.tip}` : null,
      input.utr ? `UTR ${input.utr.trim().slice(0, 40)}` : null,
      input.collectedBy?.trim()
        ? `collected by ${input.collectedBy.trim().slice(0, 40)}`
        : "confirmed by staff",
    ]
      .filter(Boolean)
      .join(" · "),
  });

  // part payments are allowed (a table splitting the bill), so the tab only
  // closes once nothing is left owing
  const after = await computeBill(repos, input.sessionId);
  const due = Math.max(0, after.net - after.paid);
  if (due > 0) return { ok: true as const, due, closed: false as const };

  const closedAt = new Date().toISOString();
  await repos.sessions.close(input.sessionId, closedAt);

  // a merged group bills through its primary, so paying it closes the whole
  // group — otherwise the joined tables would sit "dining" forever
  const merged = await repos.sessions.listActiveMergedInto(input.sessionId);
  if (merged.length > 0) {
    await repos.sessions.closeMergedInto(input.sessionId, closedAt);
  }

  // the guests are still sitting there and the table needs wiping down — a
  // waiter hands it back once it is actually ready for the next party
  await repos.tables.setNeedsCleaning([session.table_id, ...merged.map((m) => m.table_id)], true);

  return { ok: true as const, due: 0, closed: true as const, billNo: session.bill_no };
}
