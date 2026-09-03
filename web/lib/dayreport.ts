// The day's takings, tallied. Pure, so the arithmetic an owner files GST
// against can be tested without a database behind it.

export type SettledSession = {
  bill_no: string | null;
  bill_gross: number | null;
  bill_discount: number | null;
  bill_gst: number | null;
  bill_service: number | null;
  bill_tip: number | null;
  bill_net: number | null;
  guests: number | null;
  tip_to: string | null;
  settled_at: string | null;
};

export type PaymentRow = { amount_inr: number; method: string; status: string };

export type DayReport = {
  bills: number;
  covers: number;
  gross: number;
  discount: number;
  gst: number;
  service: number;
  tips: number;
  net: number;
  averageBill: number;
  byMethod: { method: string; count: number; amount: number }[];
  collected: number;
  /** what the tills should hold versus what the invoices say */
  variance: number;
};

const r0 = (n: number) => Math.round(n);

const METHOD_LABEL: Record<string, string> = {
  upi_intent: "UPI",
  cash: "Cash",
  card: "Card",
};

export function buildDayReport(
  sessions: SettledSession[],
  payments: PaymentRow[],
): DayReport {
  const billed = sessions.filter((s) => s.bill_no);
  const sum = (f: (s: SettledSession) => number | null) =>
    r0(billed.reduce((n, s) => n + Number(f(s) ?? 0), 0));

  const net = sum((s) => s.bill_net);
  const confirmed = payments.filter((p) => p.status === "confirmed");

  const methods = new Map<string, { count: number; amount: number }>();
  for (const p of confirmed) {
    const key = METHOD_LABEL[p.method] ?? p.method;
    const row = methods.get(key) ?? { count: 0, amount: 0 };
    row.count += 1;
    row.amount += Number(p.amount_inr);
    methods.set(key, row);
  }
  const collected = r0(confirmed.reduce((n, p) => n + Number(p.amount_inr), 0));

  return {
    bills: billed.length,
    covers: billed.reduce((n, s) => n + Number(s.guests ?? 0), 0),
    gross: sum((s) => s.bill_gross),
    discount: sum((s) => s.bill_discount),
    gst: sum((s) => s.bill_gst),
    service: sum((s) => s.bill_service),
    tips: sum((s) => s.bill_tip),
    net,
    averageBill: billed.length ? r0(net / billed.length) : 0,
    byMethod: [...methods.entries()]
      .map(([method, v]) => ({ method, ...v, amount: r0(v.amount) }))
      .sort((a, b) => b.amount - a.amount),
    collected,
    // a non-zero variance means an invoice was raised but not paid, or money
    // was taken that no invoice accounts for — either way, someone should look
    variance: collected - net,
  };
}
