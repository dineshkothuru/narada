import "server-only";
import { sbFetch } from "./supabase-server";
import { computeTotals, toLines, type BillLine, type GstSlab } from "./billing-math";

export type { BillLine } from "./billing-math";

export type Bill = {
  billNo: string | null;
  tableLabel: string;
  restaurantName: string;
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

type SessionRow = {
  id: string;
  status: string;
  discount_pct: number;
  service_waived: boolean;
  bill_no: string | null;
  bill_tip: number | null;
  settled_at: string | null;
  restaurant_id: string;
  table: { label: string } | null;
  orders: {
    status: string;
    items: {
      name: string;
      qty: number;
      unit_price: number;
      gst_pct: number;
      status: string;
    }[];
  }[];
  payments: { amount_inr: number; status: string }[];
};

// Single source of truth for what a table owes. GST is charged per item on the
// post-discount value (Indian practice); service charge is optional and always
// waivable on request; tip is added after tax, never taxed.
export async function computeBill(sessionId: string, tipOverride?: number): Promise<Bill> {
  const [sessions, restaurants] = await Promise.all([
    sbFetch<SessionRow[]>(
      `sessions?select=id,status,discount_pct,service_waived,bill_no,bill_tip,settled_at,restaurant_id,` +
        `table:tables(label),orders(status,items:order_items(name,qty,unit_price,gst_pct,status)),` +
        `payments(amount_inr,status)&id=eq.${encodeURIComponent(sessionId)}&limit=1`,
    ),
    sbFetch<
      { name: string; service_charge_pct: number; gstin: string | null }[]
    >(`restaurants?select=name,service_charge_pct,gstin&limit=1`),
  ]);
  if (sessions.length === 0) throw new Error("unknown session");
  const s = sessions[0];
  const rest = restaurants[0];

  const items = s.orders
    .filter((o) => o.status !== "cancelled")
    .flatMap((o) => o.items)
    // a dish the guest removed before the kitchen started is not charged for
    .filter((it) => it.status !== "cancelled");
  const totals = computeTotals({
    lines: toLines(items),
    discountPct: Number(s.discount_pct ?? 0),
    serviceChargePct: Number(rest?.service_charge_pct ?? 0),
    serviceWaived: Boolean(s.service_waived),
    tip: Number(tipOverride ?? s.bill_tip ?? 0),
  });

  const paid =
    Math.round(
      (s.payments ?? [])
        .filter((p) => p.status === "confirmed")
        .reduce((n, p) => n + Number(p.amount_inr), 0) * 100,
    ) / 100;

  return {
    billNo: s.bill_no,
    tableLabel: s.table?.label ?? "—",
    restaurantName: rest?.name ?? "Narada",
    gstin: rest?.gstin ?? null,
    ...totals,
    paid,
    settledAt: s.settled_at,
    status: s.status,
  };
}

// Mint an immutable bill number and freeze the totals at payment time.
export async function finalizeBill(sessionId: string, tip: number, restaurantId: string) {
  const bill = await computeBill(sessionId, tip);
  const rests = await sbFetch<{ bill_seq: number }[]>(
    `restaurants?select=bill_seq&id=eq.${encodeURIComponent(restaurantId)}&limit=1`,
  );
  const seq = (rests[0]?.bill_seq ?? 0) + 1;
  await sbFetch(`restaurants?id=eq.${encodeURIComponent(restaurantId)}`, {
    method: "PATCH",
    body: JSON.stringify({ bill_seq: seq }),
  });
  // whoever was serving the table earns its tip — frozen here so a later
  // change of attendant can't move money that was already handed over
  const attended = await sbFetch<{ attendant: string | null }[]>(
    `sessions?select=attendant&id=eq.${encodeURIComponent(sessionId)}&limit=1`,
  );

  const d = new Date();
  const billNo = `NAR-${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, "0")}${String(
    d.getDate(),
  ).padStart(2, "0")}-${String(seq).padStart(4, "0")}`;

  await sbFetch(`sessions?id=eq.${encodeURIComponent(sessionId)}`, {
    method: "PATCH",
    body: JSON.stringify({
      bill_no: billNo,
      bill_gross: bill.gross,
      bill_discount: bill.discount,
      bill_gst: bill.gst,
      bill_service: bill.service,
      bill_tip: bill.tip,
      tip_to: bill.tip > 0 ? (attended[0]?.attendant ?? null) : null,
      bill_net: bill.net,
      settled_at: new Date().toISOString(),
    }),
  });
  return { ...bill, billNo };
}
