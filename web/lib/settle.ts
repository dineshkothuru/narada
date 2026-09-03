import "server-only";
import { sbFetch } from "./supabase-server";
import { computeBill, finalizeBill } from "./billing";
import { splitPayment } from "./settle-math";

// Two separate steps, because they happen in different places.
//
// Raising the bill is the counter's job: it freezes the totals and mints the
// invoice number, and must happen exactly once. Collecting the money happens
// wherever the guest is — UPI at the table, cash to a waiter, or card at the
// counter — so any staff member can record a payment against a raised bill.

// Raised without a tip: nobody knows it yet. Whatever the guest pays above the
// bill becomes the tip when the payment is recorded.
export async function generateBill(sessionId: string) {
  const sessions = await sbFetch<{ id: string; restaurant_id: string; bill_no: string | null }[]>(
    `sessions?select=id,restaurant_id,bill_no&id=eq.${encodeURIComponent(sessionId)}&limit=1`,
  );
  if (sessions.length === 0) return { error: "unknown session", status: 404 } as const;
  if (sessions[0].bill_no) {
    // a double-tap at the counter must not mint a second invoice number
    return { error: "bill already raised", status: 409 } as const;
  }
  const bill = await finalizeBill(sessionId, 0, sessions[0].restaurant_id);
  return { ok: true, billNo: bill.billNo, net: bill.net } as const;
}

// Shared by every path that ends a visit.
export async function closeOpenCalls(tableIds: string[], reason: string) {
  if (tableIds.length === 0) return;
  const list = tableIds.map(encodeURIComponent).join(",");
  await sbFetch(`waiter_calls?table_id=in.(${list})&status=eq.open`, {
    method: "PATCH",
    body: JSON.stringify({
      status: "done",
      acked_at: new Date().toISOString(),
      acked_by: `auto · ${reason}`,
    }),
  });
}

export type PaymentInput = {
  sessionId: string;
  amount?: number;
  method?: "upi_intent" | "cash" | "card";
  utr?: string;
  collectedBy?: string | null;
};

export async function recordPayment(input: PaymentInput) {
  const sessions = await sbFetch<
    { id: string; table_id: string; status: string; bill_no: string | null }[]
  >(
    `sessions?select=id,table_id,status,bill_no&id=eq.${encodeURIComponent(
      input.sessionId,
    )}&limit=1`,
  );
  if (sessions.length === 0) return { error: "unknown session", status: 404 } as const;
  const session = sessions[0];
  if (session.status !== "active") return { error: "already closed", status: 409 } as const;
  if (!session.bill_no) {
    // money must never be taken against totals that can still move
    return { error: "no bill has been raised for this table yet", status: 409 } as const;
  }

  const before = await computeBill(input.sessionId);
  const dueBefore = Math.max(0, before.net - before.paid);
  const amount = typeof input.amount === "number" ? input.amount : dueBefore;
  const split = splitPayment(dueBefore, amount);

  // paying more than the bill is a tip, and it belongs to whoever served the
  // table — the frozen invoice grows by exactly that much
  if (split.tip > 0) {
    const attended = await sbFetch<{ attendant: string | null; tip_to: string | null }[]>(
      `sessions?select=attendant,tip_to&id=eq.${encodeURIComponent(input.sessionId)}&limit=1`,
    );
    await sbFetch(`sessions?id=eq.${encodeURIComponent(input.sessionId)}`, {
      method: "PATCH",
      body: JSON.stringify({
        bill_tip: Math.round(before.tip + split.tip),
        bill_net: Math.round(before.net + split.tip),
        tip_to: attended[0]?.tip_to ?? attended[0]?.attendant ?? null,
      }),
    });
  }

  await sbFetch(`payments`, {
    method: "POST",
    body: JSON.stringify({
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
    }),
  });

  // part payments are allowed (a table splitting the bill), so the tab only
  // closes once nothing is left owing
  const after = await computeBill(input.sessionId);
  const due = Math.max(0, after.net - after.paid);
  if (due > 0) return { ok: true, due, closed: false } as const;

  const closedAt = new Date().toISOString();
  await sbFetch(`sessions?id=eq.${encodeURIComponent(input.sessionId)}`, {
    method: "PATCH",
    body: JSON.stringify({ status: "closed", closed_at: closedAt }),
  });

  // a merged group bills through its primary, so paying it closes the whole
  // group — otherwise the joined tables would sit "dining" forever
  const merged = await sbFetch<{ table_id: string }[]>(
    `sessions?select=table_id&merged_into=eq.${encodeURIComponent(
      input.sessionId,
    )}&status=eq.active`,
  );
  if (merged.length > 0) {
    await sbFetch(
      `sessions?merged_into=eq.${encodeURIComponent(input.sessionId)}&status=eq.active`,
      { method: "PATCH", body: JSON.stringify({ status: "closed", closed_at: closedAt }) },
    );
  }

  // the guests are still sitting there and the table needs wiping down — a
  // waiter hands it back once it is actually ready for the next party
  const toClean = [session.table_id, ...merged.map((m) => m.table_id)];
  await sbFetch(`tables?id=in.(${toClean.map(encodeURIComponent).join(",")})`, {
    method: "PATCH",
    body: JSON.stringify({ needs_cleaning: true }),
  });

  // A call nobody got to does not stop mattering — it stops existing. Settling
  // the bill ends the visit, so any call still open for these tables is closed
  // with it rather than ticking on a table that has already paid and left.
  await closeOpenCalls(toClean, "bill settled");

  return { ok: true, due: 0, closed: true, billNo: session.bill_no } as const;
}
