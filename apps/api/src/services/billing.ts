import { computeTotals, toLines, type BillLine, type GstSlab } from "@narada/shared";
import { conflict, notFound } from "../lib/http.js";
import type { Repos } from "../repositories/index.js";

// Port of web/lib/billing.ts. The arithmetic itself lives in @narada/shared.

export type { BillLine } from "@narada/shared";

export type Bill = {
  billNo: string | null;
  tableLabel: string;
  outletName: string;
  gstin: string | null;
  lines: BillLine[];
  gross: number; // sum of item totals before discount
  discountPct: number;
  discount: number;
  taxable: number; // gross - discount
  gst: number; // GST on the discounted value, per item rate
  gstBreakup: GstSlab[];
  serviceChargePct: number;
  serviceWaived: boolean;
  service: number;
  tip: number;
  net: number; // final payable, rounded
  paid: number;
  settledAt: string | null;
  status: string;
};

type BillingRepos = Pick<Repos, "sessions" | "outlets"> & {
  transaction?: Repos["transaction"];
};

export function billDatePart(date = new Date()): string {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-CA", {
      timeZone: "Asia/Kolkata",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    })
      .formatToParts(date)
      .filter(({ type }) => type !== "literal")
      .map(({ type, value }) => [type, value]),
  );
  return `${parts.year}${parts.month}${parts.day}`;
}

// Single source of truth for what a table owes. GST is charged per item on the
// post-discount value (Indian practice); service charge is optional and always
// waivable on request; tip is added after tax, never taxed.
export async function computeBill(
  repos: BillingRepos,
  sessionId: string,
  tipOverride?: number,
  outletId?: string,
  lockSession = false,
): Promise<Bill> {
  if (!outletId) throw notFound("unknown session");
  const primaryId = await repos.sessions.findPrimaryId(sessionId, outletId);
  if (!primaryId) throw notFound("unknown session");
  const session = await repos.sessions.findForBilling(primaryId, outletId, lockSession);
  if (!session) throw notFound("unknown session");
  const outlet = await repos.outlets.findBillingConfig(session.outlet_id);

  const items = session.orders
    .filter((o) => o.status !== "cancelled")
    .flatMap((o) =>
      o.items
        .filter((it) => (it as { status?: string }).status !== "cancelled")
        .map((it) => ({
          name: it.name,
          qty: it.qty,
          unit_price: Number(it.unit_price),
          gst_pct: Number(it.gst_pct),
        })),
    );

  const totals = computeTotals({
    lines: toLines(items),
    discountPct: Number(session.discount_pct ?? 0),
    serviceChargePct: Number(outlet?.service_charge_pct ?? 0),
    serviceWaived: Boolean(session.service_waived),
    tip: Number(tipOverride ?? session.bill_tip ?? 0),
  });

  const paid =
    Math.round(
      (session.payments ?? [])
        .filter((p) => p.status === "confirmed")
        .reduce((n, p) => n + Number(p.amount_inr), 0) * 100,
    ) / 100;

  return {
    billNo: session.bill_no,
    tableLabel: session.table?.label ?? "Takeaway",
    outletName: outlet?.name ?? "Narada",
    gstin: outlet?.gstin ?? null,
    ...totals,
    paid,
    settledAt: session.settled_at,
    status: session.status,
  };
}

// Mint an immutable bill number and freeze the totals at payment time.
export async function finalizeBill(
  repos: BillingRepos,
  sessionId: string,
  tip: number,
  outletId: string,
): Promise<Bill> {
  const finish = async (bound: Pick<Repos, "sessions" | "outlets">, inTransaction = false) => {
    // The transaction-bound query locks the session before taking the bill
    // snapshot, so order/cancellation transactions cannot commit mid-freeze.
    const primaryId = await bound.sessions.findPrimaryId(sessionId, outletId);
    if (!primaryId) throw notFound("unknown session");
    // Lock the full group first, then snapshot in a separate statement. This
    // makes an order/cancellation that commits while waiting for the lock
    // visible in the frozen totals.
    await bound.sessions.lockBillingGroup(primaryId, outletId);
    const bill = await computeBill(bound, primaryId, tip, outletId);

    const datePart = billDatePart();
    const frozen = {
      bill_gross: bill.gross,
      bill_discount: bill.discount,
      bill_gst: bill.gst,
      bill_service: bill.service,
      bill_tip: bill.tip,
      bill_net: bill.net,
      settled_at: new Date().toISOString(),
    };
    const claimed = await (inTransaction
      ? bound.sessions.finalizeBillInTransaction(
          primaryId,
          frozen,
          outletId,
          datePart,
          bill.tip > 0,
        )
      : bound.sessions.finalizeBill(primaryId, frozen, outletId, datePart, bill.tip > 0));
    if (!claimed) throw conflict("bill already raised");
    return { ...bill, billNo: claimed.billNo };
  };

  if ("transaction" in repos && repos.transaction) {
    return repos.transaction((txRepos) => finish(txRepos, true));
  }
  return finish(repos);
}
