import { useState } from "react";
import AdminShell from "@/components/AdminShell";
import { SoldOutPanel } from "@/components/SoldOut";
import { Button } from "@/components/ui/button";
import { Empty, EmptyDescription } from "@/components/ui/empty";
import { Badge } from "@/components/ui/badge";
import { inr, minutesAgo } from "@narada/shared";
import {
  useAdvanceOrder,
  useCycleItemStatus,
  useKitchenOrders,
  type KitchenItem,
  type KitchenOrder,
} from "@/api/hooks";

const ITEM_NEXT: Record<KitchenItem["status"], KitchenItem["status"]> = {
  queued: "preparing",
  preparing: "ready",
  // Ready is a correction back to the kitchen, not a reset to the queue.
  ready: "preparing",
  served: "ready",
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

export default function KitchenPage() {
  const { data, isError, dataUpdatedAt } = useKitchenOrders();
  const orders = data?.orders ?? [];
  const advance = useAdvanceOrder();
  const cycleItem = useCycleItemStatus();
  const [showMenu, setShowMenu] = useState(false);

  return (
    <AdminShell>
      <main className="console min-h-dvh p-4 sm:p-6">
        <header className="mb-5 flex max-w-6xl items-center justify-between">
          <div>
            <h1 className="font-display text-2xl font-semibold text-slate-900">Narada · Kitchen</h1>
            <p className="text-xs text-slate-500">
              Auto-refreshes every 5s
              {dataUpdatedAt > 0 && ` · updated ${new Date(dataUpdatedAt).toLocaleTimeString()}`}
              {isError && (
                <span className="ml-2 font-semibold text-destructive">
                  Could not refresh orders
                </span>
              )}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="outline">
              {orders.filter((o) => o.status !== "served").length} open ·{" "}
              {orders.filter((o) => o.status === "ready").length} awaiting pickup
            </Badge>
            <Button variant="outline" size="sm" onClick={() => setShowMenu((value) => !value)}>
              {showMenu ? "Hide" : "Sold out"}
            </Button>
          </div>
        </header>

        {showMenu && (
          <section className="panel panel-lift mb-5 max-w-6xl p-4">
            <SoldOutPanel />
          </section>
        )}

        <div className="grid max-w-6xl gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {COLUMNS.map((col) => {
            const list = orders.filter((o) => o.status === col.status);
            return (
              <section key={col.status}>
                <h2 className="mb-2 text-xs font-bold tracking-widest text-slate-500 uppercase">
                  {col.title} ({list.length})
                </h2>
                <div className="flex flex-col gap-3">
                  {list.length === 0 && (
                    <Empty className="bg-white/60 py-6">
                      <EmptyDescription>No orders</EmptyDescription>
                    </Empty>
                  )}
                  {list.map((o) => (
                    <article
                      key={o.id}
                      className={`tone-${col.status === "placed" ? "rose" : col.status === "preparing" ? "sky" : col.status === "ready" ? "amber" : "emerald"} panel panel-lift`}
                    >
                      <header className="panel-head flex items-center justify-between gap-2 px-4 py-2.5">
                        <span className="flex min-w-0 items-center gap-2.5">
                          <span className="panel-pill" />
                          <span className="panel-title truncate text-sm font-bold">
                            {o.session?.table?.label ?? "Takeaway"}
                            {o.orderNo && (
                              <span className="ml-2 text-[10px] font-semibold text-slate-400">
                                KOT #{o.orderNo}
                              </span>
                            )}
                          </span>
                        </span>
                        <span className="flex shrink-0 items-center gap-2 text-[11px] text-slate-400">
                          {minutesAgo(o.created_at)}
                          <Button variant="outline" size="xs" asChild>
                            <a
                              href={`/kitchen/kot/${o.id}`}
                              target="_blank"
                              rel="noreferrer"
                              title="Reprint this ticket"
                            >
                              Print
                            </a>
                          </Button>
                        </span>
                      </header>
                      <div className="p-4">
                        <ul className="space-y-1">
                          {o.items.map((it) => (
                            <li key={it.id}>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() =>
                                  cycleItem.mutate({
                                    itemId: it.id,
                                    itemStatus: ITEM_NEXT[it.status],
                                  })
                                }
                                title="Tap to cycle: queued → preparing → ready"
                                className="h-auto w-full justify-between px-2 py-1 text-left"
                              >
                                <span>
                                  {it.qty} × {it.name}
                                  {it.notes && (
                                    <span className="block text-[11px] text-warning">
                                      ✎ {it.notes}
                                    </span>
                                  )}
                                </span>
                                <span className="ml-2 text-base">{ITEM_BADGE[it.status]}</span>
                              </Button>
                            </li>
                          ))}
                        </ul>
                        <div className="mt-3 flex items-center justify-between">
                          <span className="text-xs font-semibold text-slate-500">
                            {inr(o.total_inr)}
                            {o.placed_via === "anna" && (
                              <Badge variant="secondary" className="ml-1.5">
                                🎙️ Narada
                              </Badge>
                            )}
                          </span>
                          {NEXT[o.status] && (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() =>
                                advance.mutate({ orderId: o.id, status: NEXT[o.status]!.to })
                              }
                            >
                              {NEXT[o.status]!.label}
                            </Button>
                          )}
                        </div>
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
