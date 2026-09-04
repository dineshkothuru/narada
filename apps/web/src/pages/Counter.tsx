import { useState, type ReactNode } from "react";
import AdminShell from "@/components/AdminShell";
import { ask } from "@/components/Dialogs";
import TableSheet, { shareBillOnWhatsApp } from "@/components/TableSheet";
import { inr, minutesAgo } from "@narada/shared";
import { useCounterAction, useCounterTabs, type CounterTab } from "@/api/hooks";
import { SoldOutAlerts, SoldOutPanel } from "@/components/SoldOut";
import { useWaiterAction } from "@/api/hooks";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Empty, EmptyDescription } from "@/components/ui/empty";

// The billing desk. Raising a bill happens here and nowhere else — it freezes
// the totals and mints the invoice number. Collecting the money can happen
// anywhere, so the counter takes payments too, but so can a waiter at the table.
export default function CounterPage() {
  const { data, isError } = useCounterTabs();
  const tabs = data?.tabs ?? [];
  const action = useCounterAction();
  const waiterAction = useWaiterAction();
  const [showSoldOut, setShowSoldOut] = useState(false);
  const [openTable, setOpenTable] = useState<{ id: string; code: string; label: string } | null>(
    null,
  );

  const raiseBill = async (t: CounterTab) => {
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
    action.mutate({ action: "generate_bill", sessionId: t.sessionId });
  };

  const takePayment = async (t: CounterTab, method: "upi_intent" | "cash" | "card") => {
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
          ? [{ name: "utr", label: "UPI reference / UTR", placeholder: "optional" }]
          : []),
      ],
      confirmLabel: "Record payment",
    });
    if (out === null) return;
    const amount = Number(out.amount);
    if (!Number.isFinite(amount) || amount <= 0) return;
    action.mutate({
      action: "record_payment",
      sessionId: t.sessionId,
      amount,
      method,
      utr: out.utr,
    });
  };

  const awaitingBill = tabs.filter((t) => !t.billNo);
  const awaitingPayment = tabs.filter((t) => t.billNo && t.due > 0);

  return (
    <AdminShell>
      <main className="console min-h-dvh p-4 sm:p-6">
        <header className="mb-5 max-w-5xl">
          <h1 className="font-display text-2xl font-semibold text-slate-900">Narada · Counter</h1>
          <p className="text-xs text-slate-500">
            Raise bills here · payment can be taken anywhere
            {isError && (
              <span className="ml-2 font-semibold text-destructive">Could not refresh</span>
            )}
          </p>
          <Button variant="outline" size="sm" onClick={() => setShowSoldOut((value) => !value)}>
            {showSoldOut ? "Hide menu availability" : "Sold out"}
          </Button>
        </header>
        <SoldOutAlerts />
        {showSoldOut && (
          <section className="panel panel-lift mb-5 max-w-5xl p-4">
            <SoldOutPanel />
          </section>
        )}
        {action.isError && (
          <Alert variant="destructive" className="mb-4 max-w-5xl">
            <AlertDescription>
              {action.error instanceof Error
                ? action.error.message
                : "That action did not go through. The bill may already be raised."}
            </AlertDescription>
          </Alert>
        )}

        <Section
          title={`Awaiting a bill (${awaitingBill.length})`}
          tone="text-stone-500"
          empty="Every open table has been billed."
          rows={awaitingBill}
          render={(t) => (
            <>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setOpenTable({ id: t.sessionId, code: t.code, label: t.label })}
              >
                🧾 Details
              </Button>
              <Button variant="default" size="sm" onClick={() => raiseBill(t)}>
                Raise bill
              </Button>
            </>
          )}
        />

        <Section
          title={`Raised, awaiting payment (${awaitingPayment.length})`}
          tone="text-success"
          empty="Nothing is waiting to be paid."
          rows={awaitingPayment}
          render={(t) => (
            <>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setOpenTable({ id: t.sessionId, code: t.code, label: t.label })}
              >
                🧾 Details
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() =>
                  shareBillOnWhatsApp({
                    sessionId: t.sessionId,
                    tableCode: t.code,
                    label: t.label,
                    net: t.due,
                  })
                }
              >
                Share
              </Button>
              <Button variant="secondary" size="sm" onClick={() => takePayment(t, "upi_intent")}>
                UPI
              </Button>
              <Button variant="secondary" size="sm" onClick={() => takePayment(t, "card")}>
                Card
              </Button>
              <Button variant="default" size="sm" onClick={() => takePayment(t, "cash")}>
                Cash
              </Button>
            </>
          )}
        />

        {openTable && (
          <TableSheet
            sessionId={openTable.id}
            tableCode={openTable.code}
            label={openTable.label}
            onClose={() => setOpenTable(null)}
            onShare={(net) =>
              shareBillOnWhatsApp({
                sessionId: openTable.id,
                tableCode: openTable.code,
                label: openTable.label,
                net,
              })
            }
            onCancelItem={(itemId, name) => {
              void (async () => {
                const yes = await ask.confirm({
                  title: `Void ${name}?`,
                  message: "Unserved food is removed from the bill and recorded.",
                  confirmLabel: "Void item",
                  danger: true,
                });
                if (yes) waiterAction.mutate({ action: "cancel_item", itemId });
              })();
            }}
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
  rows: CounterTab[];
  render: (t: CounterTab) => ReactNode;
}) {
  return (
    <section className="mb-6 max-w-5xl">
      <h2 className={`mb-2 text-xs font-bold tracking-widest uppercase ${tone}`}>{title}</h2>
      {rows.length === 0 ? (
        <Empty className="card-float rounded-2xl bg-white py-6 ring-1 ring-stone-200/80">
          <EmptyDescription>{empty}</EmptyDescription>
        </Empty>
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
                      <span className="font-semibold text-warning">{t.unserved} not served</span>
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
