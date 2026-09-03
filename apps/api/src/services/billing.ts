import { computeTotals, toLines, type BillLine, type GstSlab } from "@narada/shared";
import { notFound } from "../lib/http.js";
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

type BillingRepos = Pick<Repos, "sessions" | "outlets">;

// Single source of truth for what a table owes. GST is charged per item on the
// post-discount value (Indian practice); service charge is optional and always
// waivable on request; tip is added after tax, never taxed.
export async function computeBill(
  repos: BillingRepos,
  sessionId: string,
  tipOverride?: number,
): Promise<Bill> {
  const [session, outlet] = await Promise.all([
    repos.sessions.findForBilling(sessionId),
    repos.outlets.findBillingConfig(),
  ]);
  if (!session) throw notFound("unknown session");

  const items = session.orders
    .filter((o) => o.status !== "cancelled")
    .flatMap((o) =>
      o.items.map((it) => ({
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
    tableLabel: session.table?.label ?? "—",
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
  const bill = await computeBill(repos, sessionId, tip);

  const current = await repos.outlets.findBillSeq(outletId);
  const seq = (current?.bill_seq ?? 0) + 1;
  await repos.outlets.setBillSeq(outletId, seq);

  // whoever was serving the table earns its tip — frozen here so a later
  // change of attendant can't move money that was already handed over
  const session = await repos.sessions.findById(sessionId);

  const d = new Date();
  const billNo = `NAR-${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, "0")}${String(
    d.getDate(),
  ).padStart(2, "0")}-${String(seq).padStart(4, "0")}`;

  await repos.sessions.update(sessionId, {
    bill_no: billNo,
    bill_gross: bill.gross,
    bill_discount: bill.discount,
    bill_gst: bill.gst,
    bill_service: bill.service,
    bill_tip: bill.tip,
    tip_to: bill.tip > 0 ? (session?.attendant ?? null) : null,
    bill_net: bill.net,
    settled_at: new Date().toISOString(),
  });

  return { ...bill, billNo };
}
