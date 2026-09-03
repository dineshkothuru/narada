// The money rules, with no database in sight. computeBill() fetches the rows
// and hands them here, so the arithmetic that decides what a guest pays can be
// tested directly instead of only through a live session.

export type BillLine = {
  name: string;
  qty: number;
  unitPrice: number;
  gstPct: number;
  lineTotal: number;
  lineGst: number;
};

export type GstSlab = { pct: number; taxable: number; cgst: number; sgst: number };

export type Totals = {
  lines: BillLine[];
  gross: number;
  discountPct: number;
  discount: number;
  taxable: number;
  gst: number;
  gstBreakup: GstSlab[];
  serviceChargePct: number;
  serviceWaived: boolean;
  service: number;
  tip: number;
  net: number;
};

export type RawItem = { name: string; qty: number; unit_price: number; gst_pct: number };

export const r2 = (n: number) => Math.round(n * 100) / 100;

export function toLines(items: RawItem[]): BillLine[] {
  return items.map((it) => ({
    name: it.name,
    qty: it.qty,
    unitPrice: Number(it.unit_price),
    gstPct: Number(it.gst_pct ?? 5),
    lineTotal: r2(Number(it.unit_price) * it.qty),
    lineGst: 0,
  }));
}

// GST is charged per item on the post-discount value (Indian practice) and
// split evenly into CGST and SGST; the service charge is optional and always
// waivable on request; the tip rides on top and is never taxed.
export function computeTotals(input: {
  lines: BillLine[];
  discountPct: number;
  serviceChargePct: number;
  serviceWaived: boolean;
  tip: number;
}): Totals {
  const lines = input.lines.map((l) => ({ ...l }));

  const gross = r2(lines.reduce((n, l) => n + l.lineTotal, 0));
  const discountPct = Number(input.discountPct ?? 0);
  const discount = r2((gross * discountPct) / 100);
  const taxable = r2(gross - discount);
  // the discount is spread across every line so each keeps its own GST rate
  const factor = gross > 0 ? taxable / gross : 0;

  const byRate = new Map<number, number>();
  for (const l of lines) {
    const lineTaxable = r2(l.lineTotal * factor);
    l.lineGst = r2((lineTaxable * l.gstPct) / 100);
    byRate.set(l.gstPct, r2((byRate.get(l.gstPct) ?? 0) + lineTaxable));
  }

  const gstBreakup: GstSlab[] = [...byRate.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([pct, amt]) => ({
      pct,
      taxable: amt,
      cgst: r2((amt * pct) / 200),
      sgst: r2((amt * pct) / 200),
    }));
  const gst = r2(gstBreakup.reduce((n, g) => n + g.cgst + g.sgst, 0));

  const serviceChargePct = Number(input.serviceChargePct ?? 0);
  const serviceWaived = Boolean(input.serviceWaived);
  const service = serviceWaived ? 0 : r2((taxable * serviceChargePct) / 100);
  const tip = r2(input.tip ?? 0);
  const net = Math.round(taxable + gst + service + tip);

  return {
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
  };
}
