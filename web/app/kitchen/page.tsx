"use client";

import { useCallback, useEffect, useState } from "react";
import AdminShell from "@/components/AdminShell";

type KitchenItem = {
  id: string;
  name: string;
  qty: number;
  notes: string | null;
  status: "queued" | "preparing" | "ready" | "served";
};

type KitchenOrder = {
  id: string;
  status: "placed" | "preparing" | "ready" | "served";
  total_inr: number;
  placed_via: "ui" | "anna";
  lang: string | null;
  created_at: string;
  session: { table: { label: string } | null } | null;
  items: KitchenItem[];
};

const ITEM_NEXT: Record<KitchenItem["status"], KitchenItem["status"]> = {
  queued: "preparing",
  preparing: "ready",
  ready: "queued",
  served: "queued",
};

const ITEM_BADGE: Record<KitchenItem["status"], string> = {
  queued: "⏳",
  preparing: "👨‍🍳",
  ready: "🔔",
  served: "✅",
};

const COLUMNS: { status: KitchenOrder["status"]; title: string; accent: string }[] = [
  { status: "placed", title: "New", accent: "border-rose-500" },
  { status: "preparing", title: "Preparing", accent: "border-sky-500" },
  { status: "ready", title: "Ready — pick up", accent: "border-amber-500" },
  { status: "served", title: "Served", accent: "border-green-500" },
];

const NEXT: Record<string, { to: "preparing" | "ready"; label: string } | null> = {
  placed: { to: "preparing", label: "Start preparing" },
  preparing: { to: "ready", label: "Food ready 🔔" },
  ready: null, // the waiter marks it served once it reaches the table
  served: null,
};

import { inr, minutesAgo } from "@/lib/format";

export default function KitchenPage() {
  const [orders, setOrders] = useState<KitchenOrder[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [updatedAt, setUpdatedAt] = useState<Date | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/kitchen", { cache: "no-store" });
      if (!res.ok) throw new Error(String(res.status));
      const data = await res.json();
      setOrders(data.orders ?? []);
      setError(null);
      setUpdatedAt(new Date());
    } catch {
      setError("Could not refresh orders");
    }
  }, []);

  useEffect(() => {
    const tick = () => {
      if (!document.hidden) load();
    };
    const t = setTimeout(tick, 0);
    const iv = setInterval(tick, 5000);
    document.addEventListener("visibilitychange", tick);
    return () => {
      clearTimeout(t);
      clearInterval(iv);
      document.removeEventListener("visibilitychange", tick);
    };
  }, [load]);

  const advance = async (orderId: string, to: string) => {
    setOrders((prev) =>
      prev.map((o) => (o.id === orderId ? { ...o, status: to as KitchenOrder["status"] } : o)),
    );
    await fetch("/api/kitchen", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ orderId, status: to }),
    });
    load();
  };

  const cycleItem = async (item: KitchenItem) => {
    const next = ITEM_NEXT[item.status];
    setOrders((prev) =>
      prev.map((o) => ({
        ...o,
        items: o.items.map((it) => (it.id === item.id ? { ...it, status: next } : it)),
      })),
    );
    await fetch("/api/kitchen", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ itemId: item.id, itemStatus: next }),
    });
    load();
  };

  return (
    <AdminShell>
    <main className="min-h-dvh bg-[#eeebe8] p-4 sm:p-6">
      <header className="mb-5 flex max-w-6xl items-center justify-between">
        <div>
          <h1 className="font-display text-2xl font-semibold text-stone-900">
            Narada · Kitchen
          </h1>
          <p className="text-xs text-stone-500">
            Auto-refreshes every 5s
            {updatedAt && ` · updated ${updatedAt.toLocaleTimeString()}`}
            {error && <span className="ml-2 font-semibold text-rose-600">{error}</span>}
          </p>
        </div>
        <span className="rounded-full bg-white px-3 py-1.5 text-xs font-bold text-stone-600 ring-1 ring-stone-200">
          {orders.filter((o) => o.status !== "served").length} open ·{" "}
          {orders.filter((o) => o.status === "ready").length} awaiting pickup
        </span>
      </header>

      <div className="grid max-w-6xl gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {COLUMNS.map((col) => {
          const list = orders.filter((o) => o.status === col.status);
          return (
            <section key={col.status}>
              <h2 className="mb-2 text-xs font-bold tracking-widest text-stone-500 uppercase">
                {col.title} ({list.length})
              </h2>
              <div className="flex flex-col gap-3">
                {list.length === 0 && (
                  <p className="rounded-xl bg-white/60 py-6 text-center text-xs text-stone-400">
                    No orders
                  </p>
                )}
                {list.map((o) => (
                  <article
                    key={o.id}
                    className={`rounded-2xl border-l-4 bg-white p-4 shadow-sm ${col.accent}`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-bold text-stone-900">
                        {o.session?.table?.label ?? "Unknown table"}
                      </span>
                      <span className="text-[11px] text-stone-400">{minutesAgo(o.created_at)}</span>
                    </div>
                    <ul className="mt-2 space-y-1">
                      {o.items.map((it) => (
                        <li key={it.id}>
                          <button
                            onClick={() => cycleItem(it)}
                            title="Tap to cycle: queued → preparing → ready"
                            className={`flex w-full items-center justify-between rounded-lg px-2 py-1 text-left text-sm transition active:scale-[0.98] ${
                              it.status === "served"
                                ? "bg-green-50 text-stone-400 line-through"
                                : it.status === "ready"
                                  ? "bg-amber-50 font-semibold text-stone-900"
                                  : it.status === "preparing"
                                    ? "bg-sky-50 text-stone-800"
                                    : "text-stone-700 hover:bg-stone-50"
                            }`}
                          >
                            <span>
                              {it.qty} × {it.name}
                              {it.notes && (
                                <span className="block text-[11px] text-rose-600">✎ {it.notes}</span>
                              )}
                            </span>
                            <span className="ml-2 text-base">{ITEM_BADGE[it.status]}</span>
                          </button>
                        </li>
                      ))}
                    </ul>
                    <div className="mt-3 flex items-center justify-between">
                      <span className="text-xs font-semibold text-stone-500">
                        {inr(o.total_inr)}
                        {o.placed_via === "anna" && (
                          <span className="ml-1.5 rounded bg-stone-100 px-1.5 py-0.5 text-[10px] font-bold text-stone-500">
                            🎙️ Narada
                          </span>
                        )}
                      </span>
                      {NEXT[o.status] && (
                        <button
                          onClick={() => advance(o.id, NEXT[o.status]!.to)}
                          className="rounded-full bg-stone-900 px-4 py-1.5 text-xs font-bold text-white transition active:scale-95"
                        >
                          {NEXT[o.status]!.label}
                        </button>
                      )}
                    </div>
                  </article>
                ))}
              </div>
            </section>
          );
        })}
      </div>
    </main>
    </AdminShell>
  );
}
