import { useState } from "react";
import AdminShell from "@/components/AdminShell";
import { inr, minutesAgo } from "@narada/shared";
import { useAdminOrders, type AdminOrder } from "@/api/hooks";
import { Metric, Panel } from "@/components/Panel";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Empty, EmptyDescription } from "@/components/ui/empty";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";

const RANGES = [
  { key: "today", label: "Today" },
  { key: "week", label: "Last 7 days" },
  { key: "all", label: "All time" },
] as const;

export default function AdminOrdersPage() {
  const [range, setRange] = useState<"today" | "week" | "all">("today");
  const { data } = useAdminOrders(range);
  const orders = data?.orders ?? [];
  const stats = data?.stats ?? null;
  const [open, setOpen] = useState<string | null>(null);

  const paidFor = (o: AdminOrder) =>
    (o.session?.payments ?? [])
      .filter((p) => p.status === "confirmed")
      .reduce((s, p) => s + Number(p.amount_inr), 0);

  return (
    <AdminShell>
      <main className="console min-h-dvh p-4 sm:p-6">
        <header className="mb-5 flex max-w-5xl flex-wrap items-center justify-between gap-2">
          <div>
            <h1 className="font-display text-2xl font-semibold text-slate-900">Orders</h1>
            <p className="text-xs text-slate-500">
              Every round, its table, kitchen status and payment · refreshes every 15s
            </p>
          </div>
        </header>

        <div className="mb-4 flex max-w-5xl gap-2">
          <ToggleGroup
            type="single"
            value={range}
            onValueChange={(value) => value && setRange(value as typeof range)}
            variant="outline"
          >
            {RANGES.map((r) => (
              <ToggleGroupItem key={r.key} value={r.key}>
                {r.label}
              </ToggleGroupItem>
            ))}
          </ToggleGroup>
        </div>

        {stats && (
          <section className="mb-5 grid max-w-5xl grid-cols-2 gap-3 sm:grid-cols-4">
            <Metric tone="indigo" label="Sales after discounts" value={inr(stats.netExpected)} />
            <Metric tone="emerald" label="Collected" value={inr(stats.collected)} />
            <Metric tone="rose" label="Outstanding" value={inr(stats.outstanding)} />
            <Metric tone="slate" label="Tables served" value={String(stats.tables)} />
            <Panel tone="slate" title="Top dishes" className="sm:col-span-2">
              <div className="mt-2 flex flex-wrap gap-1.5">
                {stats.topDishes.length === 0 && (
                  <span className="text-xs text-slate-400">No orders yet</span>
                )}
                {stats.topDishes.map((d) => (
                  <span
                    key={d.name}
                    className="rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-semibold text-slate-700"
                  >
                    {d.name} · {d.qty}
                  </span>
                ))}
              </div>
            </Panel>
            <Metric tone="slate" label="Avg per table" value={inr(stats.avgTable)} />
            <Metric
              tone="violet"
              label="Voice orders"
              value={`${stats.byVoice} / ${stats.orders}`}
            />
          </section>
        )}

        <section className="panel max-w-5xl overflow-hidden">
          {orders.length === 0 && (
            <Empty>
              <EmptyDescription>No orders in this range</EmptyDescription>
            </Empty>
          )}
          {orders.map((o) => {
            const paid = paidFor(o);
            const isOpen = open === o.id;
            return (
              <div key={o.id} className="border-b border-slate-100 last:border-0">
                <Button
                  variant="ghost"
                  onClick={() => setOpen(isOpen ? null : o.id)}
                  className="h-auto w-full justify-start rounded-none px-4 py-3 text-left"
                >
                  <span className="w-20 shrink-0 text-sm font-bold text-slate-900">
                    {o.session?.table?.label ?? "Takeaway"}
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
                  <Badge
                    variant={
                      o.status === "cancelled"
                        ? "secondary"
                        : o.status === "ready"
                          ? "outline"
                          : o.status === "served"
                            ? "default"
                            : "destructive"
                    }
                  >
                    {o.status}
                  </Badge>
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
                </Button>
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
