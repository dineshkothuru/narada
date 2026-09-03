import type { AdminReport } from "@narada/shared";
import type { Repos } from "../repositories/index.js";
import { badRequest } from "../lib/http.js";

const IST_OFFSET_MS = 330 * 60 * 1000;
const METHOD_LABEL: Record<string, string> = { upi_intent: "UPI", cash: "Cash", card: "Card" };
const round = (value: number) => Math.round(value);

function istDayBounds(day?: string): { day: string; from: string; to: string } {
  const requested = day ?? new Date(Date.now() + IST_OFFSET_MS).toISOString().slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(requested)) throw badRequest("bad date");
  const noon = new Date(`${requested}T12:00:00+05:30`);
  if (Number.isNaN(noon.getTime()) || noon.toISOString().slice(0, 10) !== requested) {
    throw badRequest("bad date");
  }
  const from = new Date(noon.getTime() - 12 * 60 * 60 * 1000);
  const to = new Date(from.getTime() + 24 * 60 * 60 * 1000);
  return { day: requested, from: from.toISOString(), to: to.toISOString() };
}

export async function dayReport(
  repos: Pick<Repos, "sessions" | "payments">,
  outletId: string,
  day?: string,
): Promise<AdminReport & { day: string }> {
  const bounds = istDayBounds(day);
  const sessions = await repos.sessions.listSettledBetween(bounds.from, bounds.to, outletId);
  const ids = sessions.map((session) => session.id);
  const payments = await repos.payments.listConfirmedForSessions(ids, outletId);
  const billed = sessions.filter((session) => Boolean(session.bill_no));
  const sum = (field: keyof (typeof billed)[number]) =>
    round(billed.reduce((total, session) => total + Number(session[field] ?? 0), 0));
  const net = sum("bill_net");
  const methods = new Map<string, { count: number; amount: number }>();
  for (const payment of payments) {
    const method = METHOD_LABEL[payment.method] ?? payment.method;
    const row = methods.get(method) ?? { count: 0, amount: 0 };
    row.count += 1;
    row.amount += Number(payment.amount_inr);
    methods.set(method, row);
  }
  const collected = round(
    payments.reduce((total, payment) => total + Number(payment.amount_inr), 0),
  );
  return {
    day: bounds.day,
    bills: billed.length,
    covers: billed.reduce((total, session) => total + Number(session.guests ?? 0), 0),
    gross: sum("bill_gross"),
    discount: sum("bill_discount"),
    gst: sum("bill_gst"),
    service: sum("bill_service"),
    tips: sum("bill_tip"),
    net,
    averageBill: billed.length ? round(net / billed.length) : 0,
    byMethod: [...methods.entries()]
      .map(([method, values]) => ({ method, ...values, amount: round(values.amount) }))
      .sort((a, b) => b.amount - a.amount),
    collected,
    variance: collected - net,
  };
}
