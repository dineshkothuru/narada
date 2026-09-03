"use client";

import { useCallback, useEffect, useState } from "react";
import AdminShell from "@/components/AdminShell";
import { inr } from "@/lib/format";
import { Metric, Panel } from "@/components/Panel";

type Report = {
  day: string;
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
  variance: number;
};

// The day's close. What was taken, how it was taken, and how much GST was
// collected — the question an owner asks every single night.
export default function ReportPage() {
  // today in the restaurant's own timezone, read once rather than on every render
  const [today] = useState(() =>
    new Date(Date.now() + 330 * 60_000).toISOString().slice(0, 10),
  );
  const [day, setDay] = useState(today);
  const [r, setReport] = useState<Report | null>(null);

  const load = useCallback(async () => {
    const res = await fetch(`/api/admin/report?day=${day}`, { cache: "no-store" });
    if (res.ok) setReport(await res.json());
  }, [day]);

  useEffect(() => {
    const t = setTimeout(load, 0);
    return () => clearTimeout(t);
  }, [load]);

  return (
    <AdminShell>
      <main className="console min-h-dvh p-4 sm:p-6 print:bg-white">
        <header className="mb-5 flex max-w-5xl flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="font-display text-2xl font-semibold text-slate-900">Day close</h1>
            <p className="text-xs text-slate-500">
              Takings, tax and tips for one trading day
            </p>
          </div>
          <div className="flex items-center gap-2 print:hidden">
            <input
              type="date"
              value={day}
              max={today}
              onChange={(e) => setDay(e.target.value)}
              className="rounded-xl bg-white px-3 py-2 text-xs font-semibold ring-1 ring-slate-200 outline-none"
            />
            <button
              onClick={() => window.print()}
              className="rounded-xl bg-slate-900 px-4 py-2 text-xs font-bold text-white"
            >
              🖨️ Print
            </button>
          </div>
        </header>

        {!r ? (
          <p className="text-xs text-slate-400">Loading…</p>
        ) : r.bills === 0 ? (
          <p className="panel max-w-5xl py-10 text-center text-xs text-slate-400">
            No bills were raised on this day.
          </p>
        ) : (
          <div className="flex max-w-5xl flex-col gap-3">
            <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
              <Metric tone="emerald" label="Net takings" value={inr(r.net)} icon="₹" />
              <Metric tone="indigo" label="Bills" value={String(r.bills)} icon="🧾" />
              <Metric tone="violet" label="Covers" value={String(r.covers)} icon="👥" />
              <Metric tone="sky" label="Average bill" value={inr(r.averageBill)} icon="📈" />
            </section>

            <Panel tone="emerald" title="How it adds up" hint="what the guests were charged">
              <dl className="text-xs">
                <Row label="Food & drink" value={inr(r.gross)} />
                {r.discount > 0 && (
                  <Row label="Discounts" value={`− ${inr(r.discount)}`} tone="text-green-700" />
                )}
                <Row label="GST collected" value={inr(r.gst)} tone="font-semibold" />
                {r.service > 0 && <Row label="Service charge" value={inr(r.service)} />}
                {r.tips > 0 && <Row label="Tips" value={inr(r.tips)} tone="text-green-700" />}
                <div className="mt-2 flex items-baseline justify-between border-t border-slate-200 pt-2">
                  <dt className="text-[10px] font-bold tracking-widest text-slate-400 uppercase">
                    Net
                  </dt>
                  <dd className="font-display text-xl font-semibold">{inr(r.net)}</dd>
                </div>
              </dl>
            </Panel>

            <Panel tone="sky" title="How it was paid" hint="across every method">
              {r.byMethod.map((m) => (
                <div
                  key={m.method}
                  className="flex items-center justify-between border-b border-stone-100 py-2 text-xs last:border-0"
                >
                  <span className="font-semibold text-slate-700">
                    {m.method}
                    <span className="ml-2 text-[11px] font-normal text-slate-400">
                      {m.count} payment{m.count === 1 ? "" : "s"}
                    </span>
                  </span>
                  <span className="font-bold text-slate-900">{inr(m.amount)}</span>
                </div>
              ))}
              <div className="mt-2 flex items-baseline justify-between border-t border-slate-200 pt-2 text-xs">
                <dt className="font-semibold text-slate-600">Collected</dt>
                <dd className="font-bold">{inr(r.collected)}</dd>
              </div>
              {r.variance !== 0 && (
                <p
                  className={`mt-2 rounded-xl px-3 py-2 text-[11px] font-semibold ${
                    r.variance < 0
                      ? "bg-rose-50 text-rose-700"
                      : "bg-amber-50 text-amber-800"
                  }`}
                >
                  {r.variance < 0
                    ? `${inr(-r.variance)} billed but not collected — bills raised and left unpaid.`
                    : `${inr(r.variance)} collected above what was billed — check for a payment against the wrong table.`}
                </p>
              )}
            </Panel>
          </div>
        )}
      </main>
    </AdminShell>
  );
}


function Row({ label, value, tone }: { label: string; value: string; tone?: string }) {
  return (
    <div className="flex items-baseline justify-between py-1">
      <dt className="text-slate-500">{label}</dt>
      <dd className={tone ?? "text-slate-800"}>{value}</dd>
    </div>
  );
}
