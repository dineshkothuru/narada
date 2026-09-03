import "server-only";
import { sbFetch } from "./supabase-server";

export type BillLine = {
  name: string;
  qty: number;
  unitPrice: number;
  gstPct: number;
  lineTotal: number;
  lineGst: number;
};

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
  gstBreakup: { pct: number; taxable: number; cgst: number; sgst: number }[];
  serviceChargePct: number;
  serviceWaived: boolean;
  service: number;
  tip: number;
  net: number; // final payable, rounded
  paid: number;
  settledAt: string | null;
  status: string;
};

const r2 = (n: number) => Math.round(n * 100) / 100;

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
    items: { name: string; qty: number; unit_price: number; gst_pct: number }[];
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
        `table:tables(label),orders(status,items:order_items(name,qty,unit_price,gst_pct)),` +
        `payments(amount_inr,status)&id=eq.${encodeURIComponent(sessionId)}&limit=1`,
    ),
    sbFetch<{ name: string; service_charge_pct: number; gstin: string | null }[]>(
      `restaurants?select=name,service_charge_pct,gstin&limit=1`,
    ),
  ]);
  if (sessions.length === 0) throw new Error("unknown session");
  const s = sessions[0];
  const rest = restaurants[0];

  const lines: BillLine[] = [];
  for (const o of s.orders.filter((o) => o.status !== "cancelled")) {
    for (const it of o.items) {
      const lineTotal = Number(it.unit_price) * it.qty;
      lines.push({
        name: it.name,
        qty: it.qty,
        unitPrice: Number(it.unit_price),
        gstPct: Number(it.gst_pct ?? 5),
        lineTotal,
        lineGst: 0,
      });
    }
  }

  const gross = r2(lines.reduce((n, l) => n + l.lineTotal, 0));
  const discountPct = Number(s.discount_pct ?? 0);
  const discount = r2((gross * discountPct) / 100);
  const taxable = r2(gross - discount);
  const factor = gross > 0 ? taxable / gross : 0;

  const byRate = new Map<number, number>();
  for (const l of lines) {
    const lineTaxable = r2(l.lineTotal * factor);
    l.lineGst = r2((lineTaxable * l.gstPct) / 100);
    byRate.set(l.gstPct, r2((byRate.get(l.gstPct) ?? 0) + lineTaxable));
  }
  const gstBreakup = [...byRate.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([pct, amt]) => ({
      pct,
      taxable: amt,
      cgst: r2((amt * pct) / 200),
      sgst: r2((amt * pct) / 200),
    }));
  const gst = r2(gstBreakup.reduce((n, g) => n + g.cgst + g.sgst, 0));

  const serviceChargePct = Number(rest?.service_charge_pct ?? 0);
  const serviceWaived = Boolean(s.service_waived);
  const service = serviceWaived ? 0 : r2((taxable * serviceChargePct) / 100);
  const tip = r2(tipOverride ?? Number(s.bill_tip ?? 0));
  const net = Math.round(taxable + gst + service + tip);
  const paid = r2(
    (s.payments ?? [])
      .filter((p) => p.status === "confirmed")
      .reduce((n, p) => n + Number(p.amount_inr), 0),
  );

  return {
    billNo: s.bill_no,
    tableLabel: s.table?.label ?? "—",
    restaurantName: rest?.name ?? "Narada",
    gstin: rest?.gstin ?? null,
    lines,
    gross,
    discountPct,
    discount,
    taxable,
    gst,
    gstBreakup,
    serviceChargePct,
    serviceWaived,
    service,
    tip,
    net,
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
      bill_net: bill.net,
      settled_at: new Date().toISOString(),
    }),
  });
  return { ...bill, billNo };
}
