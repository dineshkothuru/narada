"use client";

import { useCallback, useEffect, useState } from "react";
import AdminShell from "@/components/AdminShell";
import { SoldOutAlerts } from "@/components/SoldOut";
import { inr, minutesAgo } from "@/lib/format";

type AdminOrder = {
  id: string;
  status: string;
  total_inr: number;
  placed_via: "ui" | "anna";
  placed_by: string | null;
  created_at: string;
  session: {
    id: string;
    status: string;
    discount_pct: number;
    table: { label: string } | null;
    payments: { amount_inr: number; status: string; method: string }[];
  } | null;
  items: { name: string; qty: number; unit_price: number; status: string }[];
};

type Stats = {
  orders: number;
  tables: number;
  gross: number;
  netExpected: number;
  collected: number;
  outstanding: number;
  byVoice: number;
  avgTable: number;
  topDishes: { name: string; qty: number }[];
};

const RANGES = [
  { key: "today", label: "Today" },
  { key: "week", label: "Last 7 days" },
  { key: "all", label: "All time" },
];

const STATUS_STYLE: Record<string, string> = {
  placed: "bg-rose-100 text-rose-700",
  preparing: "bg-sky-100 text-sky-700",
  served: "bg-green-100 text-green-700",
  cancelled: "bg-stone-200 text-stone-500",
};

export default function AdminOrdersPage() {
  const [range, setRange] = useState("today");
  const [orders, setOrders] = useState<AdminOrder[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [open, setOpen] = useState<string | null>(null);

  const load = useCallback(async () => {
    const res = await fetch(`/api/admin/orders?range=${range}`, { cache: "no-store" });
    if (!res.ok) return;
    const d = await res.json();
    setOrders(d.orders ?? []);
    setStats(d.stats ?? null);
  }, [range]);

  useEffect(() => {
    const tick = () => {
      if (!document.hidden) load();
    };
    const t = setTimeout(tick, 0);
    const iv = setInterval(tick, 15000);
    document.addEventListener("visibilitychange", tick);
    return () => {
      clearTimeout(t);
      clearInterval(iv);
      document.removeEventListener("visibilitychange", tick);
    };
  }, [load]);

  const paidFor = (o: AdminOrder) =>
    (o.session?.payments ?? [])
      .filter((p) => p.status === "confirmed")
      .reduce((s, p) => s + Number(p.amount_inr), 0);

  return (
    <AdminShell>
    <main className="min-h-dvh bg-[#eeebe8] p-4 sm:p-6">
      <header className="mb-5 flex max-w-5xl flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="font-display text-2xl font-semibold text-stone-900">Orders</h1>
          <p className="text-xs text-stone-500">
            Every round, its table, kitchen status and payment · refreshes every 15s
          </p>
        </div>      </header>

      <SoldOutAlerts />

      <div className="mb-4 flex max-w-5xl gap-2">
        {RANGES.map((r) => (
          <button
            key={r.key}
            onClick={() => setRange(r.key)}
            className={`rounded-full px-4 py-2 text-xs font-bold transition ${
              range === r.key
                ? "bg-stone-900 text-white"
                : "bg-white text-stone-600 ring-1 ring-stone-200"
            }`}
          >
            {r.label}
          </button>
        ))}
      </div>

      {stats && (
        <section className="mb-5 grid max-w-5xl grid-cols-2 gap-3 sm:grid-cols-4">
          {[
            { label: "Sales (after discounts)", value: inr(stats.netExpected), tone: "text-stone-900" },
            { label: "Collected", value: inr(stats.collected), tone: "text-green-600" },
            { label: "Outstanding", value: inr(stats.outstanding), tone: "text-rose-600" },
            { label: "Tables served", value: String(stats.tables), tone: "text-stone-900" },
          ].map((c) => (
            <div key={c.label} className="rounded-2xl card-float bg-white p-4 ring-1 ring-stone-200/80">
              <p className="text-[10px] font-bold tracking-widest text-stone-400 uppercase">
                {c.label}
              </p>
              <p className={`font-display mt-1 text-2xl font-semibold ${c.tone}`}>{c.value}</p>
            </div>
          ))}
          <div className="rounded-2xl card-float bg-white p-4 ring-1 ring-stone-200/80 sm:col-span-2">
            <p className="text-[10px] font-bold tracking-widest text-stone-400 uppercase">
              Top dishes
            </p>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {stats.topDishes.length === 0 && (
                <span className="text-xs text-stone-400">No orders yet</span>
              )}
              {stats.topDishes.map((d) => (
                <span
                  key={d.name}
                  className="rounded-full bg-stone-100 px-2.5 py-1 text-[11px] font-semibold text-stone-700"
                >
                  {d.name} · {d.qty}
                </span>
              ))}
            </div>
          </div>
          <div className="rounded-2xl card-float bg-white p-4 ring-1 ring-stone-200/80">
            <p className="text-[10px] font-bold tracking-widest text-stone-400 uppercase">
              Avg per table
            </p>
            <p className="font-display mt-1 text-2xl font-semibold">{inr(stats.avgTable)}</p>
          </div>
          <div className="rounded-2xl card-float bg-white p-4 ring-1 ring-stone-200/80">
            <p className="text-[10px] font-bold tracking-widest text-stone-400 uppercase">
              🎙️ Voice orders
            </p>
            <p className="font-display mt-1 text-2xl font-semibold">
              {stats.byVoice}
              <span className="ml-1 text-sm font-medium text-stone-400">
                / {stats.orders}
              </span>
            </p>
          </div>
        </section>
      )}

      <section className="max-w-5xl overflow-hidden rounded-3xl card-float bg-white ring-1 ring-stone-200/80">
        {orders.length === 0 && (
          <p className="py-10 text-center text-sm text-stone-400">No orders in this range</p>
        )}
        {orders.map((o) => {
          const paid = paidFor(o);
          const isOpen = open === o.id;
          return (
            <div key={o.id} className="border-b border-stone-100 last:border-0">
              <button
                onClick={() => setOpen(isOpen ? null : o.id)}
                className="flex w-full items-center gap-3 px-4 py-3 text-left transition hover:bg-stone-50"
              >
                <span className="w-20 shrink-0 text-sm font-bold text-stone-900">
                  {o.session?.table?.label ?? "—"}
                </span>
                <span className="min-w-0 flex-1 truncate text-xs text-stone-500">
                  {o.items.map((i) => `${i.qty}× ${i.name}`).join(", ")}
                </span>
                {o.placed_via === "anna" && <span title="ordered by voice">🎙️</span>}
                {o.placed_by && (
                  <span className="hidden rounded bg-stone-100 px-1.5 py-0.5 text-[10px] font-bold text-stone-500 sm:inline">
                    {o.placed_by}
                  </span>
                )}
                <span
                  className={`rounded-full px-2 py-0.5 text-[10px] font-extrabold uppercase ${
                    STATUS_STYLE[o.status] ?? "bg-stone-100 text-stone-600"
                  }`}
                >
                  {o.status}
                </span>
                <span className="w-20 shrink-0 text-right text-sm font-bold text-stone-800">
                  {Number(o.total_inr) === 0 ? "🎁 free" : inr(o.total_inr)}
                </span>
                <span className="hidden w-24 shrink-0 text-right text-[11px] font-semibold sm:block">
                  {o.session?.status === "closed" ? (
                    <span className="text-green-600">paid {inr(paid)}</span>
                  ) : (
                    <span className="text-rose-600">open tab</span>
                  )}
                </span>
                <span className="hidden w-20 shrink-0 text-right text-[11px] text-stone-400 sm:block">
                  {minutesAgo(o.created_at)}
                </span>
              </button>
              {isOpen && (
                <div className="bg-stone-50 px-4 py-3 text-xs">
                  <div className="grid gap-1 sm:grid-cols-2">
                    <div>
                      {o.items.map((i, n) => (
                        <div key={n} className="flex justify-between py-0.5 text-stone-700">
                          <span>
                            {i.qty} × {i.name}
                            <span className="ml-2 text-[10px] text-stone-400 uppercase">
                              {i.status}
                            </span>
                          </span>
                          <span className="font-semibold">
                            {inr(Number(i.unit_price) * i.qty)}
                          </span>
                        </div>
                      ))}
                    </div>
                    <div className="text-stone-500 sm:text-right">
                      <p>Order #{o.id.slice(0, 8).toUpperCase()}</p>
                      <p>{new Date(o.created_at).toLocaleString()}</p>
                      {(o.session?.discount_pct ?? 0) > 0 && (
                        <p className="font-semibold text-rose-600">
                          🎡 table discount −{o.session?.discount_pct}%
                        </p>
                      )}
                      <p>
                        session {o.session?.status}
                        {o.session?.payments?.length
                          ? ` · ${o.session.payments.map((p) => p.method).join(", ")}`
                          : ""}
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </section>
    </main>
    </AdminShell>
  );
}
