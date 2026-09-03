"use client";

import { useCallback, useEffect, useState } from "react";
import AdminShell from "@/components/AdminShell";
import { ask } from "@/components/Dialogs";
import TableSheet, { shareBillOnWhatsApp } from "@/components/TableSheet";
import { inr, minutesAgo } from "@/lib/format";

type Tab = {
  sessionId: string;
  tableId: string;
  label: string;
  mergedWith: string[];
  since: string;
  attendant: string | null;
  billNo: string | null;
  rounds: number;
  unserved: number;
  gross: number;
  discount: number;
  gst: number;
  service: number;
  serviceWaived: boolean;
  paid: number;
  due: number;
};

// The billing desk. Raising a bill happens here and nowhere else — it freezes
// the totals and mints the invoice number. Collecting the money can happen
// anywhere, so the counter takes payments too, but so can a waiter at the table.
export default function CounterPage() {
  const [tabs, setTabs] = useState<Tab[]>([]);
  const [openTable, setOpenTable] = useState<{ id: string; label: string } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [cashier, setCashier] = useState(() => {
    if (typeof window === "undefined") return "";
    try {
      return localStorage.getItem("narada:staff-name") ?? "";
    } catch {
      return "";
    }
  });

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/counter", { cache: "no-store" });
      if (!res.ok) return;
      const d = await res.json();
      setTabs(d.tabs ?? []);
    } catch {}
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
    setError(null);
    const res = await fetch("/api/counter", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const d = await res.json().catch(() => ({}));
      setError(d.error ?? "That did not go through");
    }
    load();
  };

  const rememberCashier = (who: string) => {
    if (!who.trim()) return;
    setCashier(who.trim());
    try {
      localStorage.setItem("narada:staff-name", who.trim());
    } catch {}
  };

  const raiseBill = async (t: Tab) => {
    if (t.unserved > 0) {
      const go = await ask.confirm({
        title: `${t.label} still has food coming`,
        message: `${t.unserved} round${t.unserved === 1 ? "" : "s"} not served yet. Raise the bill anyway?`,
        confirmLabel: "Raise it",
      });
      if (!go) return;
    }
    const yes = await ask.confirm({
      title: `Raise bill for ${t.label}`,
      message: `${inr(t.due)} — totals are frozen once the bill is raised. Any tip is added later, from whatever the guest pays above it.`,
      confirmLabel: "Raise bill",
    });
    if (!yes) return;
    await act({ action: "generate_bill", sessionId: t.sessionId });
  };

  const takePayment = async (t: Tab, method: "upi_intent" | "cash" | "card") => {
    const out = await ask.form({
      title: `${t.label} · bill ${inr(t.due)}`,
      message:
        method === "cash"
          ? "Enter what you kept after handing back change. Anything above the bill is recorded as a tip."
          : "Anything received above the bill is recorded as a tip.",
      fields: [
        {
          name: "amount",
          label: "Amount received (₹)",
          defaultValue: String(t.due),
          inputMode: "numeric",
          required: true,
          hint: `Bill is ${inr(t.due)}`,
        },
        ...(method === "upi_intent"
          ? [
              {
                name: "utr",
                label: "UPI reference / UTR",
                placeholder: "optional",
              },
            ]
          : []),
        { name: "by", label: "Taken by", defaultValue: cashier, placeholder: "your name" },
      ],
      confirmLabel: "Record payment",
    });
    if (out === null) return;
    const amount = Number(out.amount);
    if (!Number.isFinite(amount) || amount <= 0) return;
    rememberCashier(out.by ?? "");
    await act({
      action: "record_payment",
      sessionId: t.sessionId,
      amount,
      method,
      utr: out.utr,
      collectedBy: out.by,
    });
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
        attendedBy: cashier,
      }),
    });
    load();
  };

  const awaitingBill = tabs.filter((t) => !t.billNo);
  const awaitingPayment = tabs.filter((t) => t.billNo && t.due > 0);

  return (
    <AdminShell>
      <main className="min-h-dvh bg-[#eeebe8] p-4 sm:p-6">
        <header className="mb-5 max-w-5xl">
          <h1 className="font-display text-2xl font-semibold text-stone-900">
            Narada · Counter
          </h1>
          <p className="text-xs text-stone-500">
            Raise bills here · payment can be taken anywhere
            {error && <span className="ml-2 font-semibold text-rose-600">{error}</span>}
          </p>
        </header>

        <Section
          title={`Awaiting a bill (${awaitingBill.length})`}
          tone="text-stone-500"
          empty="Every open table has been billed."
          rows={awaitingBill}
          render={(t) => (
            <>
              <button
                onClick={() => setOpenTable({ id: t.sessionId, label: t.label })}
                className="rounded-full bg-white px-3 py-1.5 text-xs font-bold text-stone-600 ring-1 ring-stone-200"
              >
                🧾 Details
              </button>
              <button
                onClick={() => raiseBill(t)}
                className="rounded-full bg-stone-900 px-4 py-1.5 text-xs font-bold text-white transition active:scale-95"
              >
                Raise bill
              </button>
            </>
          )}
        />

        <Section
          title={`Raised, awaiting payment (${awaitingPayment.length})`}
          tone="text-green-700"
          empty="Nothing is waiting to be paid."
          rows={awaitingPayment}
          render={(t) => (
            <>
              <button
                onClick={() => setOpenTable({ id: t.sessionId, label: t.label })}
                className="rounded-full bg-white px-3 py-1.5 text-xs font-bold text-stone-600 ring-1 ring-stone-200"
              >
                🧾 Details
              </button>
              <button
                onClick={() =>
                  shareBillOnWhatsApp({
                    sessionId: t.sessionId,
                    label: t.label,
                    net: t.due,
                  })
                }
                className="rounded-full bg-white px-3 py-1.5 text-xs font-bold text-green-700 ring-1 ring-green-200"
              >
                Share
              </button>
              <button
                onClick={() => takePayment(t, "upi_intent")}
                className="rounded-full bg-green-600 px-3.5 py-1.5 text-xs font-bold text-white transition active:scale-95"
              >
                UPI
              </button>
              <button
                onClick={() => takePayment(t, "card")}
                className="rounded-full bg-sky-600 px-3.5 py-1.5 text-xs font-bold text-white transition active:scale-95"
              >
                Card
              </button>
              <button
                onClick={() => takePayment(t, "cash")}
                className="rounded-full bg-stone-900 px-3.5 py-1.5 text-xs font-bold text-white transition active:scale-95"
              >
                Cash
              </button>
            </>
          )}
        />

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
          />
        )}
      </main>
    </AdminShell>
  );
}

function Section({
  title,
  tone,
  empty,
  rows,
  render,
}: {
  title: string;
  tone: string;
  empty: string;
  rows: Tab[];
  render: (t: Tab) => React.ReactNode;
}) {
  return (
    <section className="mb-6 max-w-5xl">
      <h2 className={`mb-2 text-xs font-bold tracking-widest uppercase ${tone}`}>{title}</h2>
      {rows.length === 0 ? (
        <p className="card-float rounded-2xl bg-white py-6 text-center text-xs text-stone-400 ring-1 ring-stone-200/80">
          {empty}
        </p>
      ) : (
        <div className="flex flex-col gap-2">
          {rows.map((t) => (
            <article
              key={t.sessionId}
              className="card-float rounded-2xl bg-white p-4 ring-1 ring-stone-200/80"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <h3 className="truncate text-sm font-bold text-stone-900">{t.label}</h3>
                  <p className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px] text-stone-500">
                    <span>{minutesAgo(t.since, true)}</span>
                    <span>
                      {t.rounds} round{t.rounds === 1 ? "" : "s"}
                    </span>
                    {t.unserved > 0 && (
                      <span className="font-semibold text-amber-600">
                        {t.unserved} not served
                      </span>
                    )}
                    {t.attendant && <span>👤 {t.attendant}</span>}
                  </p>
                  <p className="mt-0.5 flex flex-wrap items-center gap-x-2 text-[10px] text-stone-400">
                    {t.billNo && <span className="font-bold">{t.billNo}</span>}
                    {t.mergedWith.length > 0 && <span>🔗 with {t.mergedWith.join(", ")}</span>}
                    {t.serviceWaived && <span>service waived</span>}
                  </p>
                </div>
                <span className="font-display shrink-0 text-lg font-semibold text-stone-900">
                  {inr(t.due)}
                </span>
              </div>
              <div className="mt-3 flex flex-wrap gap-1.5">{render(t)}</div>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}
