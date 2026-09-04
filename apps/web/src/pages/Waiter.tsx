import { useEffect, useState } from "react";
import { useNavigate } from "react-router";
import AdminShell from "@/components/AdminShell";
import { ask } from "@/components/Dialogs";
import TableSheet, { shareBillOnWhatsApp } from "@/components/TableSheet";
import CallTimer from "@/components/CallTimer";
import { inr, minutesAgo } from "@narada/shared";
import {
  useFloorAction,
  useTips,
  useWaiterAction,
  useWaiterTables,
  useMe,
  type WaiterTable,
} from "@/api/hooks";
import { Empty, EmptyDescription } from "@/components/ui/empty";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

// what the host did is visible to the waiter straight away, before any food
// has been ordered
const STATUS_LABEL: Record<string, string> = {
  seated: "Seated · yet to order",
  dining: "Dining",
  settling: "Needs a bill",
  billed: "Billed · awaiting payment",
  paid: "Paid",
};
const STATUS_VARIANT: Record<string, "default" | "secondary" | "success" | "warning" | "info"> = {
  seated: "info",
  dining: "info",
  settling: "warning",
  billed: "info",
  paid: "success",
};

const LANG_BADGE: Record<string, string> = {
  en: "EN",
  hi: "हिं",
  te: "తె",
};

export default function WaiterPage() {
  const navigate = useNavigate();
  const { data, isError, refetch } = useWaiterTables();
  const tables = data?.tables ?? [];
  const { data: tips } = useTips();
  const { data: me } = useMe();
  const displayName = me?.displayName ?? "";
  const action = useWaiterAction();
  const floorAction = useFloorAction();
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 15_000);
    return () => window.clearInterval(timer);
  }, []);
  const [openTable, setOpenTable] = useState<{
    id: string;
    tableCode: string;
    label: string;
  } | null>(null);

  const calls = tables.filter((t) => t.call);
  // food the kitchen has plated and is waiting for a waiter to carry out
  const readyItems = tables.flatMap((t) =>
    (t.session?.orders ?? []).flatMap((order) =>
      order.items.filter((item) => item.status === "ready").map((item) => ({ table: t, item })),
    ),
  );
  const active = tables.filter((t) => t.session);
  const waitingToOrder = active
    .filter((t) => t.session!.orders.length === 0)
    .sort((a, b) => Date.parse(a.session!.since) - Date.parse(b.session!.since));
  const running = active.filter((t) => t.session!.orders.length > 0);
  const toClean = tables.filter((t) => !t.session && t.needsCleaning);
  // Attribute waiter work to the authenticated identity returned by /me.
  const myTips =
    displayName && tips
      ? (tips.rows.find((r) => r.attendant === displayName) ?? {
          attendant: displayName,
          tips: 0,
          tables: 0,
        })
      : null;

  return (
    <AdminShell>
      <main className="console min-h-dvh p-4 sm:p-6">
        <header className="mb-5 flex max-w-5xl items-center justify-between">
          <div>
            <h1 className="font-display text-2xl font-semibold text-slate-900">Narada · Waiter</h1>
            <p className="text-xs text-slate-500">
              Calls, running tabs &amp; payments · refreshes every 5s
              {isError && (
                <span className="ml-2 font-semibold text-destructive">Could not refresh</span>
              )}
            </p>
          </div>
        </header>

        {myTips && (
          <section className="panel panel-lift mb-5 flex max-w-5xl items-center justify-between p-4">
            <div>
              <p className="text-[10px] font-bold tracking-widest text-stone-400 uppercase">
                Your tips today
              </p>
              <p className="text-xs text-stone-500">
                {displayName} · {myTips.tables} table{myTips.tables === 1 ? "" : "s"} settled
              </p>
            </div>
            <span className="font-display text-2xl font-semibold text-success">
              {inr(myTips.tips)}
            </span>
          </section>
        )}

        {calls.length > 0 && (
          <section className="mb-5 max-w-5xl">
            <h2 className="mb-2 text-xs font-bold tracking-widest text-slate-500 uppercase">
              Waiter calls ({calls.length})
            </h2>
            <div className="flex flex-col gap-2">
              {calls.map((t) => (
                <div
                  key={t.call!.id}
                  className="tone-rose panel panel-lift flex animate-pulse items-center justify-between p-4"
                >
                  <span className="flex items-center gap-2 text-sm font-bold text-slate-900">
                    {t.label}
                    <CallTimer since={t.call!.created_at} />
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={async () => {
                      action.mutate({
                        action: "ack_call",
                        callId: t.call!.id,
                        sessionId: t.session?.id,
                      });
                    }}
                  >
                    On it ✋
                  </Button>
                </div>
              ))}
            </div>
          </section>
        )}

        {readyItems.length > 0 && (
          <section className="mb-5 max-w-5xl">
            <h2 className="mb-2 text-xs font-bold tracking-widest text-slate-500 uppercase">
              Ready to serve ({readyItems.length})
            </h2>
            <div className="flex flex-col gap-2">
              {readyItems.map(({ table, item }) => (
                <div
                  key={item.id}
                  className="tone-amber panel panel-lift flex items-center justify-between gap-3 p-4"
                >
                  <span className="min-w-0">
                    <span className="text-sm font-bold text-slate-900">{table.label}</span>
                    <span className="ml-2 text-xs text-slate-500">
                      {item.qty}× {item.name}
                    </span>
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => action.mutate({ action: "mark_item_served", itemId: item.id })}
                    className="shrink-0"
                  >
                    Served ✅
                  </Button>
                </div>
              ))}
            </div>
          </section>
        )}

        {toClean.length > 0 && (
          <section className="mb-5 max-w-5xl">
            <h2 className="mb-2 text-xs font-bold tracking-widest text-slate-500 uppercase">
              Awaiting cleaning ({toClean.length})
            </h2>
            <div className="flex flex-col gap-2">
              {toClean.map((t) => (
                <div
                  key={t.tableId}
                  className="panel panel-lift flex items-center justify-between gap-3 p-4"
                >
                  <span className="min-w-0">
                    <span className="text-sm font-bold text-stone-900">{t.label}</span>
                    <span className="ml-2 text-xs text-stone-500">
                      Bill settled · clear and wipe before seating anyone
                    </span>
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => action.mutate({ action: "clear_table", tableId: t.tableId })}
                    className="shrink-0"
                  >
                    Table ready ✓
                  </Button>
                </div>
              ))}
            </div>
          </section>
        )}

        {waitingToOrder.length > 0 && (
          <section className="mb-5 max-w-5xl">
            <h2 className="mb-2 text-xs font-bold tracking-widest text-slate-500 uppercase">
              Waiting to order ({waitingToOrder.length})
            </h2>
            <div className="grid gap-3 sm:grid-cols-2">
              {waitingToOrder.map((t) => (
                <WaiterCard
                  key={t.tableId}
                  table={t}
                  waitingNow={now}
                  onClaim={() =>
                    floorAction.mutate(
                      { action: "attendant", sessionId: t.session!.id },
                      { onSettled: () => void refetch() },
                    )
                  }
                  onOpen={() => navigate(`/waiter/table/${encodeURIComponent(t.code)}`)}
                />
              ))}
            </div>
          </section>
        )}

        <section className="max-w-5xl">
          <h2 className="mb-2 text-xs font-bold tracking-widest text-slate-500 uppercase">
            Running tables ({running.length})
          </h2>
          <div className="grid gap-3 sm:grid-cols-2">
            {running.length === 0 && (
              <Empty className="bg-white/60 py-8 sm:col-span-2">
                <EmptyDescription>No running tables</EmptyDescription>
              </Empty>
            )}
            {running.map((t) => (
              <WaiterCard
                key={t.tableId}
                table={t}
                onOpen={() => navigate(`/waiter/table/${encodeURIComponent(t.code)}`)}
              />
            ))}
          </div>
          <p className="mt-4 text-center text-[11px] text-stone-400">
            Marking paid records the payment and closes the table&apos;s tab.
          </p>
        </section>

        {openTable && (
          <TableSheet
            sessionId={openTable.id}
            tableCode={openTable.tableCode}
            label={openTable.label}
            onClose={() => setOpenTable(null)}
            onShare={(net) =>
              shareBillOnWhatsApp({
                sessionId: openTable.id,
                tableCode: openTable.tableCode,
                label: openTable.label,
                net,
              })
            }
            onCancelItem={async (itemId, name) => {
              const yes = await ask.confirm({
                title: `Void ${name}?`,
                message: "Unserved food is removed from the bill and recorded.",
                confirmLabel: "Void item",
                danger: true,
              });
              if (yes) action.mutate({ action: "cancel_item", itemId });
            }}
          />
        )}
      </main>
    </AdminShell>
  );
}

function WaiterCard({
  table: t,
  waitingNow,
  onClaim,
  onOpen,
}: {
  table: WaiterTable;
  waitingNow?: number;
  onClaim?: () => void;
  onOpen: () => void;
}) {
  const action = useWaiterAction();
  const s = t.session!;

  return (
    <article
      className={`tone-${t.call ? "rose" : s.status === "settling" ? "amber" : s.status === "billed" ? "sky" : "indigo"} panel panel-lift p-4 ${
        t.call ? "animate-pulse" : ""
      }`}
    >
      <div className="panel-head -mx-4 -mt-4 mb-3 flex items-center justify-between gap-2 px-4 py-3">
        <span className="flex items-center gap-1.5 text-sm font-bold text-slate-900">
          {t.label}
          {s.langs.map((l) => (
            <Badge variant="secondary" key={l} title="language this table ordered in">
              {LANG_BADGE[l] ?? l.toUpperCase()}
            </Badge>
          ))}
        </span>
        <span className="flex items-center gap-1.5 text-[11px] text-slate-400">
          <Badge variant={STATUS_VARIANT[s.status] ?? "secondary"}>
            {STATUS_LABEL[s.status] ?? s.status}
          </Badge>
          open {minutesAgo(s.since, true)}
        </span>
      </div>
      {s.attendant && (
        <Badge variant="info" className="mt-1">
          👤 {s.attendant}
        </Badge>
      )}
      {s.orders.length === 0 && (
        <div className="mt-2 flex items-center justify-between gap-2 rounded-lg bg-violet-50 px-2.5 py-2 text-[11px] font-semibold text-violet-700">
          <span>
            {!s.attendant && "NOBODY ASSIGNED · "}Waiting{" "}
            {waitingNow ? minutesAgo(s.since, true) : "to order"}
          </span>
          {!s.attendant ? (
            <Button variant="outline" size="xs" onClick={onClaim}>
              I&apos;ll take it
            </Button>
          ) : null}
        </div>
      )}
      <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-600">
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
          <span className="font-bold text-destructive">-{s.discountPct}% 🎡</span>
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
              ? "text-muted-foreground"
              : s.due > 0
                ? "text-destructive"
                : "text-success"
          }`}
        >
          {s.orders.length === 0 ? "—" : s.due > 0 ? `Due ${inr(s.due)}` : "Settled ✓"}
        </span>
        {s.due <= 0 && (
          <Button variant="outline" size="sm" onClick={onOpen}>
            Workspace
          </Button>
        )}
        {s.due > 0 && (
          <div className="flex flex-wrap justify-end gap-1.5">
            <Button variant="outline" size="sm" onClick={onOpen}>
              🧾 Details
            </Button>
            {s.billNo ? (
              <>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() =>
                    shareBillOnWhatsApp({
                      sessionId: s.id,
                      tableCode: t.code,
                      label: t.label,
                      net: s.due,
                    })
                  }
                >
                  Share
                </Button>
                <Button
                  variant="default"
                  size="sm"
                  onClick={async () => {
                    const out = await ask.form({
                      title: `${t.label} · bill ${inr(s.due)}`,
                      message: "Anything received above the bill is recorded as a tip.",
                      fields: [
                        {
                          name: "amount",
                          label: "Amount received (₹)",
                          defaultValue: String(s.due),
                          inputMode: "numeric",
                          required: true,
                          hint: `Bill is ${inr(s.due)}`,
                        },
                        { name: "utr", label: "UPI reference / UTR", placeholder: "optional" },
                      ],
                      confirmLabel: "Record payment",
                    });
                    if (out === null) return;
                    const amount = Number(out.amount);
                    if (!Number.isFinite(amount) || amount <= 0) return;
                    action.mutate({
                      action: "record_payment",
                      sessionId: s.id,
                      amount,
                      method: "upi_intent",
                      utr: out.utr,
                    });
                  }}
                >
                  Paid UPI
                </Button>
                <Button
                  variant="default"
                  size="sm"
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
                    action.mutate({
                      action: "record_payment",
                      sessionId: s.id,
                      amount,
                      method: "cash",
                    });
                  }}
                >
                  Paid cash
                </Button>
              </>
            ) : (
              <Badge variant="warning">Awaiting bill</Badge>
            )}
          </div>
        )}
      </div>
    </article>
  );
}
