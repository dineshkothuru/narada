"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import AdminShell from "@/components/AdminShell";

type WaiterTable = {
  tableId: string;
  label: string;
  code: string;
  call: { id: string; created_at: string } | null;
  session: {
    id: string;
    since: string;
    orders: { id: string; status: string; total_inr: number; created_at: string }[];
    ordered: number;
    paid: number;
    attendant: string | null;
    discountPct: number;
    gst: number;
    service: number;
    serviceWaived: boolean;
    due: number;
  } | null;
};

import { inr, minutesAgo } from "@/lib/format";
import CallTimer from "@/components/CallTimer";

export default function WaiterPage() {
  const [tables, setTables] = useState<WaiterTable[]>([]);
  const [error, setError] = useState<string | null>(null);
  // remembered per device so a waiter types their name once per shift
  const [lastAttendant, setLastAttendant] = useState(() => {
    if (typeof window === "undefined") return "";
    try {
      return localStorage.getItem("narada:staff-name") ?? "";
    } catch {
      return "";
    }
  });

  useEffect(() => {
    try {
      if (lastAttendant) localStorage.setItem("narada:staff-name", lastAttendant);
    } catch {}
  }, [lastAttendant]);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/waiter", { cache: "no-store" });
      if (!res.ok) throw new Error(String(res.status));
      const d = await res.json();
      setTables(d.tables ?? []);
      setError(null);
    } catch {
      setError("Could not refresh");
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

  const act = async (body: Record<string, unknown>) => {
    await fetch("/api/waiter", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    load();
  };

  const calls = tables.filter((t) => t.call);
  const active = tables.filter((t) => t.session);

  return (
    <AdminShell>
    <main className="min-h-dvh bg-stone-100 p-4 sm:p-6">
      <header className="mx-auto mb-5 flex max-w-3xl items-center justify-between">
        <div>
          <h1 className="font-display text-2xl font-semibold text-stone-900">
            Narada · Waiter
          </h1>
          <p className="text-xs text-stone-500">
            Calls, running tabs &amp; payments · refreshes every 5s
            {error && <span className="ml-2 font-semibold text-rose-600">{error}</span>}
          </p>
        </div>
        <div className="flex gap-2">
          <Link
            href="/kitchen"
            className="rounded-full bg-white px-4 py-2 text-xs font-bold text-stone-600 ring-1 ring-stone-200"
          >
            Kitchen
          </Link>
          <Link
            href="/admin"
            className="rounded-full bg-white px-4 py-2 text-xs font-bold text-stone-600 ring-1 ring-stone-200"
          >
            Admin
          </Link>
        </div>
      </header>

      {calls.length > 0 && (
        <section className="mx-auto mb-5 max-w-3xl">
          <h2 className="mb-2 text-xs font-bold tracking-widest text-rose-600 uppercase">
            🔔 Waiter calls ({calls.length})
          </h2>
          <div className="flex flex-col gap-2">
            {calls.map((t) => (
              <div
                key={t.call!.id}
                className="flex animate-pulse items-center justify-between rounded-2xl border-l-4 border-rose-500 bg-white p-4 shadow-sm"
              >
                <span className="flex items-center gap-2 text-sm font-bold text-stone-900">
                  {t.label}
                  <CallTimer since={t.call!.created_at} />
                </span>
                <button
                  onClick={() => {
                    const who = prompt(
                      `Attending ${t.label} — your name (shown as this table's attendant):`,
                      lastAttendant,
                    );
                    if (who === null) return;
                    if (who.trim()) setLastAttendant(who.trim());
                    act({
                      action: "ack_call",
                      callId: t.call!.id,
                      sessionId: t.session?.id,
                      attendedBy: who,
                    });
                  }}
                  className="rounded-full bg-stone-900 px-5 py-2 text-xs font-bold text-white transition active:scale-95"
                >
                  On it ✋
                </button>
              </div>
            ))}
          </div>
        </section>
      )}

      <section className="mx-auto max-w-3xl">
        <h2 className="mb-2 text-xs font-bold tracking-widest text-stone-500 uppercase">
          Open tables ({active.length})
        </h2>
        <div className="grid gap-3 sm:grid-cols-2">
          {active.length === 0 && (
            <p className="rounded-xl bg-white/60 py-8 text-center text-xs text-stone-400 sm:col-span-2">
              No open tables
            </p>
          )}
          {active.map((t) => {
            const s = t.session!;
            return (
              <article key={t.tableId} className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-stone-200/60">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-bold text-stone-900">{t.label}</span>
                  <span className="text-[11px] text-stone-400">
                    open {minutesAgo(s.since, true)}
                  </span>
                </div>
                <button
                  onClick={() => {
                    const who = prompt(
                      `Who is serving ${t.label}?`,
                      s.attendant ?? lastAttendant,
                    );
                    if (who === null) return;
                    if (who.trim()) setLastAttendant(who.trim());
                    fetch("/api/floor", {
                      method: "PATCH",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({
                        action: "attendant",
                        sessionId: s.id,
                        attendant: who,
                      }),
                    }).then(load);
                  }}
                  className={`mt-1 w-fit rounded-full px-2.5 py-0.5 text-[10px] font-extrabold ${
                    s.attendant
                      ? "bg-violet-100 text-violet-700"
                      : "bg-stone-100 text-stone-400"
                  }`}
                >
                  {s.attendant ? `👤 ${s.attendant}` : "+ assign attendant"}
                </button>
                <div className="mt-2 flex gap-4 text-xs text-stone-600">
                  <span>
                    {s.orders.length} order{s.orders.length !== 1 ? "s" : ""}
                  </span>
                  <span>billed {inr(s.ordered)}</span>
                  {s.discountPct > 0 && (
                    <span className="font-bold text-rose-600">-{s.discountPct}% 🎡</span>
                  )}
                  <span>+GST {inr(s.gst)}</span>
                  {s.service > 0 && <span>+svc {inr(s.service)}</span>}
                  {s.serviceWaived && <span className="text-stone-400">svc waived</span>}
                  <span>paid {inr(s.paid)}</span>
                </div>
                <div className="mt-3 flex items-center justify-between">
                  <span
                    className={`text-sm font-extrabold ${
                      s.due > 0 ? "text-rose-600" : "text-green-600"
                    }`}
                  >
                    {s.due > 0 ? `Due ${inr(s.due)}` : "Settled ✓"}
                  </span>
                  {s.due > 0 && (
                    <div className="flex gap-1.5">
                      <a
                        href={`/bill/${s.id}`}
                        target="_blank"
                        className="rounded-full bg-white px-3 py-1.5 text-xs font-bold text-stone-600 ring-1 ring-stone-200"
                      >
                        🧾 Bill
                      </a>
                      <button
                        onClick={() => {
                          const utr = prompt(
                            `UPI reference / UTR for ${t.label} (${inr(s.due)}) — paste from your UPI app, or leave blank:`,
                            "",
                          );
                          if (utr === null) return;
                          act({
                            action: "mark_paid",
                            sessionId: s.id,
                            amount: s.due,
                            method: "upi_intent",
                            utr,
                          });
                        }}
                        className="rounded-full bg-green-600 px-3.5 py-1.5 text-xs font-bold text-white transition active:scale-95"
                      >
                        Paid UPI
                      </button>
                      <button
                        onClick={() =>
                          act({
                            action: "mark_paid",
                            sessionId: s.id,
                            amount: s.due,
                            method: "cash",
                          })
                        }
                        className="rounded-full bg-stone-900 px-3.5 py-1.5 text-xs font-bold text-white transition active:scale-95"
                      >
                        Paid cash
                      </button>
                    </div>
                  )}
                </div>
              </article>
            );
          })}
        </div>
        <p className="mt-4 text-center text-[11px] text-stone-400">
          Marking paid records the payment and closes the table&apos;s tab.
        </p>
      </section>
    </main>
    </AdminShell>
  );
}
