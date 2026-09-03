"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import AdminShell from "@/components/AdminShell";
import { ask } from "@/components/Dialogs";
import TableSheet, { shareBillOnWhatsApp } from "@/components/TableSheet";
import type { Tone } from "@/components/Panel";

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
      items: { id: string; name: string; qty: number; status: string }[];
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
  seated: "Yet to order",
  dining: "Dining",
  settling: "Needs a bill",
  billed: "Awaiting payment",
  paid: "Paid",
};
const STATUS_TONE: Record<string, Tone> = {
  seated: "violet",
  dining: "indigo",
  settling: "amber",
  billed: "sky",
  paid: "emerald",
};
const STATUS_CHIP: Record<string, string> = {
  seated: "bg-violet-100 text-violet-700",
  dining: "bg-sky-100 text-sky-700",
  settling: "bg-amber-100 text-amber-800",
  billed: "bg-sky-100 text-sky-800",
  paid: "bg-emerald-100 text-emerald-700",
};

const LANG_BADGE: Record<string, { label: string; cls: string }> = {
  en: { label: "EN", cls: "bg-slate-200 text-slate-700" },
  hi: { label: "हिं", cls: "bg-slate-100 text-slate-700" },
  te: { label: "తె", cls: "bg-slate-100 text-slate-700" },
};


export default function WaiterPage() {
  const router = useRouter();
  const [tables, setTables] = useState<WaiterTable[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [openTable, setOpenTable] = useState<{
    id: string;
    label: string;
    code: string;
  } | null>(null);
  // a ticking clock so "12m with no order" keeps counting without a reload
  const [now, setNow] = useState(0);
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
    const tick = () => setNow(Date.now());
    const t = setTimeout(tick, 0);
    const iv = setInterval(tick, 15_000);
    return () => {
      clearTimeout(t);
      clearInterval(iv);
    };
  }, []);

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

  // a waiter claiming a table they are on their way to, without typing a name
  // twice — the shift name is already remembered on this device
  const claim = async (t: WaiterTable) => {
    let who = lastAttendant.trim();
    if (!who) {
      const asked = await ask.prompt({
        title: `Taking ${t.label}`,
        message: "You'll be shown as this table's attendant.",
        label: "Your name",
        required: true,
        confirmLabel: "Take it",
      });
      if (asked === null) return;
      who = asked.trim();
      if (who) setLastAttendant(who);
    }
    await fetch("/api/floor", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "attendant", sessionId: t.session!.id, attendant: who }),
    });
    load();
  };

  const act = async (body: Record<string, unknown>) => {
    await fetch("/api/waiter", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    load();
  };

  const cancelItem = async (itemId: string, name: string) => {
    const yes = await ask.confirm({
      title: `Remove ${name}?`,
      message: "It comes off the bill. This is recorded against your name.",
      confirmLabel: "Remove it",
      danger: true,
    });
    if (!yes) return;
    await fetch("/api/waiter", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "cancel_item",
        itemId,
        attendedBy: lastAttendant,
      }),
    });
    load();
  };

  const calls = tables.filter((t) => t.call);
  // every dish the kitchen has plated, whether or not the rest of its round is
  // done — a starter waiting on a slow main should not sit under the lamp
  const readyItems = tables.flatMap((t) =>
    (t.session?.orders ?? []).flatMap((order) =>
      (order.items ?? [])
        .filter((it) => it.status === "ready")
        .map((item) => ({ table: t, order, item })),
    ),
  );
  const active = tables.filter((t) => t.session);
  // A party sitting with nothing ordered is the most urgent thing on this
  // screen and the easiest to miss — it looks calm precisely because nothing
  // has happened yet. It gets its own list, longest wait first, so a waiter is
  // never deciding which of eleven identical cards to read.
  const waitingToOrder = active
    .filter((t) => t.session!.orders.length === 0)
    .sort((a, b) => Date.parse(a.session!.since) - Date.parse(b.session!.since));
  const running = active.filter((t) => t.session!.orders.length > 0);
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
    <main className="console min-h-dvh p-4 sm:p-6">
      <header className="mb-5 flex max-w-5xl items-center justify-between">
        <div>
          <h1 className="font-display text-2xl font-semibold text-slate-900">
            Narada · Waiter
          </h1>
          <p className="text-xs text-slate-500">
            Calls, running tabs &amp; payments · refreshes every 5s
            {error && <span className="ml-2 font-semibold text-rose-600">{error}</span>}
          </p>
        </div>      </header>

      {myTips && (
        <section className="mb-5 flex max-w-5xl items-center justify-between rounded-2xl panel panel-lift p-4">
          <div>
            <p className="text-[10px] font-bold tracking-widest text-slate-400 uppercase">
              Your tips today
            </p>
            <p className="text-xs text-slate-500">
              {lastAttendant} · {myTips.tables} table{myTips.tables === 1 ? "" : "s"} settled
            </p>
          </div>
          <span className="font-display text-2xl font-semibold text-emerald-700">
            {inr(myTips.tips)}
          </span>
        </section>
      )}

      {calls.length > 0 && (
        <section className="mb-5 max-w-5xl">
          <h2 className="mb-2 text-xs font-bold tracking-widest text-slate-500 uppercase">
            🔔 Waiter calls ({calls.length})
          </h2>
          <div className="flex flex-col gap-2">
            {calls.map((t) => (
              <div
                key={t.call!.id}
                className="flex animate-pulse items-center justify-between rounded-2xl panel panel-lift border-l-4 border-rose-500 p-4"
              >
                <span className="flex items-center gap-2 text-sm font-bold text-slate-900">
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
                  className="rounded-full bg-slate-900 px-5 py-2 text-xs font-bold text-white transition active:scale-95"
                >
                  On it ✋
                </button>
              </div>
            ))}
          </div>
        </section>
      )}

      {readyItems.length > 0 && (
        <section className="mb-5 max-w-5xl">
          <h2 className="mb-2 text-xs font-bold tracking-widest text-slate-500 uppercase">
            🔔 Ready to serve ({readyItems.length})
          </h2>
          <div className="flex flex-col gap-2">
            {readyItems.map(({ table, order, item }) => {
              const stillCooking = order.items.filter(
                (i) =>
                  i.status !== "ready" && i.status !== "served" && i.status !== "cancelled",
              ).length;
              return (
                <div
                  key={item.id}
                  className="tone-amber panel panel-lift flex items-center justify-between gap-3 p-4"
                >
                  <span className="min-w-0">
                    <span className="text-sm font-bold text-slate-900">{table.label}</span>
                    <span className="ml-2 text-xs font-semibold text-slate-700">
                      {item.qty}× {item.name}
                    </span>
                    {stillCooking > 0 && (
                      <span className="ml-2 text-[11px] text-slate-400">
                        · {stillCooking} more still cooking
                      </span>
                    )}
                  </span>
                  <button
                    onClick={() => act({ action: "mark_item_served", itemId: item.id })}
                    className="shrink-0 rounded-full bg-amber-500 px-5 py-2 text-xs font-bold text-white transition active:scale-95"
                  >
                    Served ✅
                  </button>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {toClean.length > 0 && (
        <section className="mb-5 max-w-5xl">
          <h2 className="mb-2 text-xs font-bold tracking-widest text-slate-500 uppercase">
            🧹 Awaiting cleaning ({toClean.length})
          </h2>
          <div className="flex flex-col gap-2">
            {toClean.map((t) => (
              <div
                key={t.tableId}
                className="flex items-center justify-between gap-3 rounded-2xl panel panel-lift border-l-4 border-stone-400 p-4"
              >
                <span className="min-w-0">
                  <span className="text-sm font-bold text-slate-900">{t.label}</span>
                  <span className="ml-2 text-xs text-slate-500">
                    Bill settled · clear and wipe before seating anyone
                  </span>
                </span>
                <button
                  onClick={() => act({ action: "clear_table", tableId: t.tableId })}
                  className="shrink-0 rounded-full bg-slate-800 px-5 py-2 text-xs font-bold text-white transition active:scale-95"
                >
                  Table ready ✓
                </button>
              </div>
            ))}
          </div>
        </section>
      )}

      {waitingToOrder.length > 0 && (
        <section className="mb-5 max-w-5xl">
          <h2 className="mb-2 text-xs font-bold tracking-widest text-slate-500 uppercase">
            ✋ Waiting to order ({waitingToOrder.length})
          </h2>
          <div className="flex flex-col gap-2">
            {waitingToOrder.map((t) => {
              const mins = Math.max(0, Math.floor((now - Date.parse(t.session!.since)) / 60000));
              // ten minutes seated with no order is a table nobody has been to
              const late = mins >= 10;
              return (
                <div
                  key={t.tableId}
                  onClick={() => router.push(`/waiter/table/${t.code}`)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") router.push(`/waiter/table/${t.code}`);
                  }}
                  role="link"
                  tabIndex={0}
                  title={`Take ${t.label}'s order`}
                  className={`tone-violet panel panel-lift flex cursor-pointer flex-wrap items-center justify-between gap-3 border-l-4 p-4 ${
                    late ? "border-rose-500" : "border-violet-400"
                  }`}
                >
                  <span className="min-w-0">
                    <span className="text-sm font-bold text-slate-900">{t.label}</span>
                    {t.session!.guests && (
                      <span className="ml-2 text-xs text-slate-500">
                        🪑 {t.session!.guests} seated
                      </span>
                    )}
                    <span
                      className={`ml-2 text-xs font-bold ${late ? "text-rose-600" : "text-slate-500"}`}
                    >
                      {mins}m with no order
                    </span>
                    {!t.session!.attendant && (
                      <span className="ml-2 rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-extrabold text-amber-800">
                        NOBODY ASSIGNED
                      </span>
                    )}
                  </span>
                  <span
                    onClick={(e) => e.stopPropagation()}
                    className="flex shrink-0 gap-1.5"
                  >
                    {!t.session!.attendant && (
                      <button
                        onClick={() => claim(t)}
                        className="rounded-full bg-indigo-50 px-4 py-2 text-xs font-bold text-indigo-700 ring-1 ring-indigo-200 transition active:scale-95"
                      >
                        I&apos;ll take it
                      </button>
                    )}
                  </span>
                </div>
              );
            })}
          </div>
        </section>
      )}

      <section className="max-w-5xl">
        <h2 className="mb-2 text-xs font-bold tracking-widest text-slate-500 uppercase">
          Running tables ({running.length})
        </h2>
        <div className="grid gap-3 sm:grid-cols-2">
          {running.length === 0 && (
            <p className="panel py-8 text-center text-xs text-slate-400 sm:col-span-2">
              Nothing running
            </p>
          )}
          {running.map((t) => {
            const s = t.session!;
            return (
              <article
                key={t.tableId}
                onClick={() => router.push(`/waiter/table/${t.code}`)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") router.push(`/waiter/table/${t.code}`);
                }}
                role="button"
                tabIndex={0}
                title={`Open ${t.label}`}
                className={`tone-${t.call ? "rose" : (STATUS_TONE[s.status] ?? "slate")} panel panel-lift cursor-pointer ${
                  t.call ? "ring-2 ring-rose-400" : ""
                }`}
              >
                <header className="panel-head flex items-center justify-between gap-2 px-4 py-2.5">
                  <span className="panel-title flex min-w-0 items-center gap-2.5 text-sm font-bold">
                    <span className="panel-pill" />
                    {t.label}
                    {s.langs.map((l) => (
                      <span
                        key={l}
                        title="language this table ordered in"
                        className={`rounded px-1.5 py-0.5 text-[10px] font-extrabold ${LANG_BADGE[l]?.cls ?? "bg-slate-200 text-slate-700"}`}
                      >
                        {LANG_BADGE[l]?.label ?? l.toUpperCase()}
                      </span>
                    ))}
                  </span>
                  <span className="flex items-center gap-1.5 text-[11px] text-slate-400">
                    <span
                      className={`rounded-full px-1.5 py-0.5 text-[10px] font-extrabold ${
                        STATUS_CHIP[s.status] ?? "bg-slate-100 text-slate-500"
                      }`}
                    >
                      {STATUS_LABEL[s.status] ?? s.status}
                    </span>
                    open {minutesAgo(s.since, true)}
                  </span>
                </header>
                <div className="p-4">
                <div
                  onClick={(e) => e.stopPropagation()}
                  className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-slate-500"
                >
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
                  className={`shrink-0 rounded-full px-2.5 py-0.5 text-[10px] font-extrabold ${
                    s.attendant
                      ? "bg-violet-100 text-violet-700"
                      : "bg-slate-100 text-slate-400"
                  }`}
                >
                  {s.attendant ? `👤 ${s.attendant}` : "+ assign attendant"}
                </button>
                  {s.guests ? (
                    <span>
                      🪑 {s.guests}/{t.capacity}
                    </span>
                  ) : null}
                  <span>
                    {s.orders.length} round{s.orders.length !== 1 ? "s" : ""}
                  </span>
                  {s.discountPct > 0 && (
                    <span className="font-bold text-rose-600">−{s.discountPct}% 🎡</span>
                  )}
                </div>

                <div className="mt-3 flex items-end justify-between gap-3">
                  {/* the arithmetic behind the figure, demoted to a caption —
                      it is reference, not the thing being scanned for */}
                  <p className="min-w-0 truncate text-[10px] text-slate-400">
                    {inr(s.ordered)} + GST {inr(s.gst)}
                    {s.service > 0 && ` + svc ${inr(s.service)}`}
                    {s.serviceWaived && " · svc waived"}
                    {s.paid > 0 && ` · paid ${inr(s.paid)}`}
                  </p>
                  {/* an open tab is the normal state of a table, not a fault —
                      the figure is just the figure */}
                  <p
                    className={`font-display shrink-0 text-xl font-semibold tabular-nums ${
                      s.due > 0 ? "text-slate-900" : "text-emerald-600"
                    }`}
                  >
                    {s.due > 0 ? inr(s.due) : "Settled ✓"}
                  </p>
                </div>

                <div
                  onClick={(e) => e.stopPropagation()}
                  className="mt-3 flex flex-wrap items-center gap-1.5"
                >
                  {s.due > 0 && (
                    <div className="flex gap-1.5">
                      {!s.billNo ? (
                        // the counter raises the bill; a waiter can only carry
                        // it and take the money against it
                        <span className="rounded-full bg-slate-100 px-3 py-1.5 text-[11px] font-bold text-slate-400">
                          Awaiting bill from counter
                        </span>
                      ) : (
                        <>
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
                            className="rounded-full bg-emerald-600 px-3.5 py-1.5 text-xs font-bold text-white transition active:scale-95"
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
                            className="rounded-full bg-slate-900 px-3.5 py-1.5 text-xs font-bold text-white transition active:scale-95"
                          >
                            Paid cash
                          </button>
                        </>
                      )}
                    </div>
                  )}
                </div>
                </div>
              </article>
            );
          })}
        </div>
        <p className="mt-4 text-center text-[11px] text-slate-400">
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
          onCancelItem={cancelItem}
          tableCode={openTable.code}
        />
      )}
    </main>
    </AdminShell>
  );
}
