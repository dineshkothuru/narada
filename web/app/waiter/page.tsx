"use client";

import { useCallback, useEffect, useState } from "react";
import AdminShell from "@/components/AdminShell";
import { ask } from "@/components/Dialogs";
import TableSheet, { shareBillOnWhatsApp } from "@/components/TableSheet";

type WaiterTable = {
  tableId: string;
  label: string;
  code: string;
  capacity: number;
  call: { id: string; created_at: string } | null;
  needsCleaning: boolean;
  session: {
    id: string;
    since: string;
    guests: number | null;
    status: "seated" | "dining" | "settling" | "billed" | "paid" | "free" | "cleaning";
    orders: {
      id: string;
      status: string;
      total_inr: number;
      created_at: string;
      items: { name: string; qty: number }[];
    }[];
    ordered: number;
    paid: number;
    attendant: string | null;
    langs: string[];
    billNo: string | null;
    discountPct: number;
    gst: number;
    service: number;
    serviceWaived: boolean;
    due: number;
  } | null;
};

import { inr, minutesAgo } from "@/lib/format";
import CallTimer from "@/components/CallTimer";
// what the host did is visible to the waiter straight away, before any food
// has been ordered
const STATUS_LABEL: Record<string, string> = {
  seated: "Seated · yet to order",
  dining: "Dining",
  settling: "Needs a bill",
  billed: "Billed · awaiting payment",
  paid: "Paid",
};
const STATUS_CHIP: Record<string, string> = {
  seated: "bg-violet-100 text-violet-700",
  dining: "bg-sky-100 text-sky-700",
  settling: "bg-amber-100 text-amber-800",
  billed: "bg-sky-100 text-sky-800",
  paid: "bg-green-100 text-green-700",
};

const LANG_BADGE: Record<string, { label: string; cls: string }> = {
  en: { label: "EN", cls: "bg-stone-200 text-stone-700" },
  hi: { label: "हिं", cls: "bg-orange-100 text-orange-700" },
  te: { label: "తె", cls: "bg-teal-100 text-teal-700" },
};


export default function WaiterPage() {
  const [tables, setTables] = useState<WaiterTable[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [openTable, setOpenTable] = useState<{ id: string; label: string } | null>(null);
  const [tips, setTips] = useState<{ rows: { attendant: string; tips: number; tables: number }[] } | null>(null);
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

  useEffect(() => {
    const loadTips = () => {
      fetch("/api/waiter/tips", { cache: "no-store" })
        .then((r) => (r.ok ? r.json() : null))
        .then((d) => d && setTips(d))
        .catch(() => {});
    };
    loadTips();
    const iv = setInterval(loadTips, 30_000);
    return () => clearInterval(iv);
  }, []);

  const act = async (body: Record<string, unknown>) => {
    await fetch("/api/waiter", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    load();
  };

  const calls = tables.filter((t) => t.call);
  // food the kitchen has plated and is waiting for a waiter to carry out
  const readyRounds = tables.flatMap((t) =>
    (t.session?.orders ?? [])
      .filter((o) => o.status === "ready")
      .map((order) => ({ table: t, order })),
  );
  const active = tables.filter((t) => t.session);
  const toClean = tables.filter((t) => !t.session && t.needsCleaning);
  // "me" is the name this waiter attends tables under, remembered per device
  const myTips =
    lastAttendant.trim() && tips
      ? (tips.rows.find((r) => r.attendant === lastAttendant.trim()) ?? {
          attendant: lastAttendant.trim(),
          tips: 0,
          tables: 0,
        })
      : null;

  return (
    <AdminShell>
    <main className="min-h-dvh bg-[#eeebe8] p-4 sm:p-6">
      <header className="mb-5 flex max-w-5xl items-center justify-between">
        <div>
          <h1 className="font-display text-2xl font-semibold text-stone-900">
            Narada · Waiter
          </h1>
          <p className="text-xs text-stone-500">
            Calls, running tabs &amp; payments · refreshes every 5s
            {error && <span className="ml-2 font-semibold text-rose-600">{error}</span>}
          </p>
        </div>      </header>

      {myTips && (
        <section className="mb-5 flex max-w-5xl items-center justify-between rounded-2xl card-float bg-white p-4 ring-1 ring-stone-200/80">
          <div>
            <p className="text-[10px] font-bold tracking-widest text-stone-400 uppercase">
              Your tips today
            </p>
            <p className="text-xs text-stone-500">
              {lastAttendant} · {myTips.tables} table{myTips.tables === 1 ? "" : "s"} settled
            </p>
          </div>
          <span className="font-display text-2xl font-semibold text-green-700">
            {inr(myTips.tips)}
          </span>
        </section>
      )}

      {calls.length > 0 && (
        <section className="mb-5 max-w-5xl">
          <h2 className="mb-2 text-xs font-bold tracking-widest text-rose-600 uppercase">
            🔔 Waiter calls ({calls.length})
          </h2>
          <div className="flex flex-col gap-2">
            {calls.map((t) => (
              <div
                key={t.call!.id}
                className="flex animate-pulse items-center justify-between rounded-2xl card-float border-l-4 border-rose-500 bg-white p-4"
              >
                <span className="flex items-center gap-2 text-sm font-bold text-stone-900">
                  {t.label}
                  <CallTimer since={t.call!.created_at} />
                </span>
                <button
                  onClick={async () => {
                    const who = await ask.prompt({
                      title: `Attending ${t.label}`,
                      message: "You'll be shown as this table's attendant.",
                      label: "Your name",
                      defaultValue: lastAttendant,
                      confirmLabel: "On it",
                    });
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

      {readyRounds.length > 0 && (
        <section className="mb-5 max-w-5xl">
          <h2 className="mb-2 text-xs font-bold tracking-widest text-amber-600 uppercase">
            🔔 Ready to serve ({readyRounds.length})
          </h2>
          <div className="flex flex-col gap-2">
            {readyRounds.map(({ table, order }) => (
              <div
                key={order.id}
                className="flex items-center justify-between gap-3 rounded-2xl card-float border-l-4 border-amber-500 bg-white p-4"
              >
                <span className="min-w-0">
                  <span className="text-sm font-bold text-stone-900">{table.label}</span>
                  <span className="ml-2 text-xs text-stone-500">
                    {order.items.map((i) => `${i.qty}× ${i.name}`).join(", ")}
                  </span>
                </span>
                <button
                  onClick={() => act({ action: "mark_served", orderId: order.id })}
                  className="shrink-0 rounded-full bg-amber-500 px-5 py-2 text-xs font-bold text-white transition active:scale-95"
                >
                  Served ✅
                </button>
              </div>
            ))}
          </div>
        </section>
      )}

      {toClean.length > 0 && (
        <section className="mb-5 max-w-5xl">
          <h2 className="mb-2 text-xs font-bold tracking-widest text-stone-500 uppercase">
            🧹 Awaiting cleaning ({toClean.length})
          </h2>
          <div className="flex flex-col gap-2">
            {toClean.map((t) => (
              <div
                key={t.tableId}
                className="flex items-center justify-between gap-3 rounded-2xl card-float border-l-4 border-stone-400 bg-white p-4"
              >
                <span className="min-w-0">
                  <span className="text-sm font-bold text-stone-900">{t.label}</span>
                  <span className="ml-2 text-xs text-stone-500">
                    Bill settled · clear and wipe before seating anyone
                  </span>
                </span>
                <button
                  onClick={() => act({ action: "clear_table", tableId: t.tableId })}
                  className="shrink-0 rounded-full bg-stone-800 px-5 py-2 text-xs font-bold text-white transition active:scale-95"
                >
                  Table ready ✓
                </button>
              </div>
            ))}
          </div>
        </section>
      )}

      <section className="max-w-5xl">
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
              <article
                key={t.tableId}
                className={`card-float rounded-2xl bg-white p-4 ${
                  t.call
                    ? "animate-pulse ring-4 ring-rose-500 shadow-rose-200"
                    : "ring-1 ring-stone-200/80"
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="flex items-center gap-1.5 text-sm font-bold text-stone-900">
                    {t.label}
                    {s.langs.map((l) => (
                      <span
                        key={l}
                        title="language this table ordered in"
                        className={`rounded px-1.5 py-0.5 text-[10px] font-extrabold ${LANG_BADGE[l]?.cls ?? "bg-stone-200 text-stone-700"}`}
                      >
                        {LANG_BADGE[l]?.label ?? l.toUpperCase()}
                      </span>
                    ))}
                  </span>
                  <span className="flex items-center gap-1.5 text-[11px] text-stone-400">
                    <span
                      className={`rounded-full px-1.5 py-0.5 text-[10px] font-extrabold ${
                        STATUS_CHIP[s.status] ?? "bg-stone-100 text-stone-500"
                      }`}
                    >
                      {STATUS_LABEL[s.status] ?? s.status}
                    </span>
                    open {minutesAgo(s.since, true)}
                  </span>
                </div>
                <button
                  onClick={async () => {
                    const who = await ask.prompt({
                      title: `Attendant for ${t.label}`,
                      message: "Leave it empty to unassign the table.",
                      label: "Waiter's name",
                      defaultValue: s.attendant ?? lastAttendant,
                      confirmLabel: "Assign",
                    });
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
                <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-stone-600">
                  {s.guests ? (
                    <span>
                      🪑 {s.guests}/{t.capacity} seated
                    </span>
                  ) : null}
                  <span>
                    {s.orders.length === 0
                      ? "nothing ordered yet"
                      : `${s.orders.length} order${s.orders.length !== 1 ? "s" : ""}`}
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
                      s.orders.length === 0
                        ? "text-stone-300"
                        : s.due > 0
                          ? "text-rose-600"
                          : "text-green-600"
                    }`}
                  >
                    {s.orders.length === 0
                      ? "—"
                      : s.due > 0
                        ? `Due ${inr(s.due)}`
                        : "Settled ✓"}
                  </span>
                  {s.due > 0 && (
                    <div className="flex flex-wrap justify-end gap-1.5">
                      <button
                        onClick={() => setOpenTable({ id: s.id, label: t.label })}
                        className="rounded-full bg-white px-3 py-1.5 text-xs font-bold text-stone-600 ring-1 ring-stone-200"
                      >
                        🧾 Details
                      </button>
                      {!s.billNo ? (
                        // the counter raises the bill; a waiter can only carry
                        // it and take the money against it
                        <span className="rounded-full bg-stone-100 px-3 py-1.5 text-[11px] font-bold text-stone-400">
                          Awaiting bill from counter
                        </span>
                      ) : (
                        <>
                          <button
                            onClick={() =>
                              shareBillOnWhatsApp({
                                sessionId: s.id,
                                label: t.label,
                                net: s.due,
                              })
                            }
                            className="rounded-full bg-white px-3 py-1.5 text-xs font-bold text-green-700 ring-1 ring-green-200"
                          >
                            Share
                          </button>
                          <button
                            onClick={async () => {
                              const out = await ask.form({
                                title: `${t.label} · bill ${inr(s.due)}`,
                                message:
                                  "Anything received above the bill is recorded as a tip.",
                                fields: [
                                  {
                                    name: "amount",
                                    label: "Amount received (₹)",
                                    defaultValue: String(s.due),
                                    inputMode: "numeric",
                                    required: true,
                                    hint: `Bill is ${inr(s.due)}`,
                                  },
                                  {
                                    name: "utr",
                                    label: "UPI reference / UTR",
                                    placeholder: "optional",
                                  },
                                ],
                                confirmLabel: "Record payment",
                              });
                              if (out === null) return;
                              const amount = Number(out.amount);
                              if (!Number.isFinite(amount) || amount <= 0) return;
                              act({
                                action: "record_payment",
                                sessionId: s.id,
                                amount,
                                method: "upi_intent",
                                utr: out.utr,
                                collectedBy: lastAttendant,
                              });
                            }}
                            className="rounded-full bg-green-600 px-3.5 py-1.5 text-xs font-bold text-white transition active:scale-95"
                          >
                            Paid UPI
                          </button>
                          <button
                            onClick={async () => {
                              const kept = await ask.prompt({
                                title: `${t.label} · bill ${inr(s.due)}`,
                                message:
                                  "Enter what you kept after handing back change. Anything above the bill is recorded as a tip.",
                                label: "Cash kept (₹)",
                                defaultValue: String(s.due),
                                inputMode: "numeric",
                                required: true,
                                confirmLabel: "Record payment",
                              });
                              if (kept === null) return;
                              const amount = Number(kept);
                              if (!Number.isFinite(amount) || amount <= 0) return;
                              act({
                                action: "record_payment",
                                sessionId: s.id,
                                amount,
                                method: "cash",
                                collectedBy: lastAttendant,
                              });
                            }}
                            className="rounded-full bg-stone-900 px-3.5 py-1.5 text-xs font-bold text-white transition active:scale-95"
                          >
                            Paid cash
                          </button>
                        </>
                      )}
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

      {openTable && (
        <TableSheet
          sessionId={openTable.id}
          label={openTable.label}
          onClose={() => setOpenTable(null)}
          onShare={(net) =>
            shareBillOnWhatsApp({
              sessionId: openTable.id,
              label: openTable.label,
              net,
            })
          }
        />
      )}
    </main>
    </AdminShell>
  );
}
