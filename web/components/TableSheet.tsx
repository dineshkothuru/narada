"use client";

import { useCallback, useEffect, useState } from "react";
import { inr } from "@/lib/format";
import { ask } from "./Dialogs";
import OrderPad from "./OrderPad";

type RoundItem = { id: string; name: string; qty: number; status: string };
type Round = {
  id: string;
  status: string;
  createdAt: string;
  placedBy: string | null;
  placedVia: string | null;
  totalInr: number;
  items: RoundItem[];
};
type Sheet = {
  billNo: string | null;
  lines: { name: string; qty: number; unitPrice: number; lineTotal: number }[];
  gross: number;
  discountPct: number;
  discount: number;
  gst: number;
  serviceChargePct: number;
  serviceWaived: boolean;
  service: number;
  tip: number;
  net: number;
  paid: number;
  rounds: Round[];
};

const ITEM_MARK: Record<string, { icon: string; cls: string }> = {
  queued: { icon: "⏳", cls: "text-slate-400" },
  preparing: { icon: "👨‍🍳", cls: "text-sky-600" },
  ready: { icon: "🔔", cls: "font-semibold text-amber-600" },
  served: { icon: "✅", cls: "text-emerald-600" },
  cancelled: { icon: "✕", cls: "text-slate-400" },
};

// Everything a table has ordered and everything it owes, in one floating panel.
// A waiter or the owner taps a table and gets the answer without walking to the
// counter — it stays available until the tab is paid and closed.
export default function TableSheet({
  sessionId,
  label,
  onClose,
  onShare,
  onCancelItem,
  tableCode,
  /** render as a full page instead of a popup over the screen behind it */
  page = false,
  actions,
}: {
  sessionId: string;
  label: string;
  onClose: () => void;
  /** enables the Menu tab, which adds another round to this table */
  tableCode?: string;
  page?: boolean;
  onShare?: (net: number) => void;
  /** staff only — voids a dish and takes it off the bill */
  onCancelItem?: (itemId: string, name: string) => Promise<void> | void;
  actions?: React.ReactNode;
}) {
  const [sheet, setSheet] = useState<Sheet | null>(null);
  const [error, setError] = useState(false);
  // details and the menu are two views of one table, not two windows
  const [tab, setTab] = useState<"details" | "menu">("details");
  const [menu, setMenu] = useState<{
    categories: { id: string; name: string; emoji: string }[];
    items: {
      id: string;
      categoryId: string;
      name: string;
      priceInr: number;
      isVeg: boolean;
      isAvailable: boolean;
      emoji: string;
    }[];
  } | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch(`/api/bill?session=${encodeURIComponent(sessionId)}`, {
        cache: "no-store",
      });
      if (!res.ok) {
        setError(true);
        return;
      }
      setSheet(await res.json());
    } catch {
      setError(true);
    }
  }, [sessionId]);

  useEffect(() => {
    const t = setTimeout(load, 0);
    const iv = setInterval(load, 8000);
    return () => {
      clearTimeout(t);
      clearInterval(iv);
    };
  }, [load]);

  useEffect(() => {
    if (page) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [onClose, page]);

  // the menu is only fetched when the tab is actually opened
  useEffect(() => {
    if (tab !== "menu" || menu || !tableCode) return;
    let off = false;
    fetch(`/api/waiter/menu?table=${encodeURIComponent(tableCode)}`, { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (!off && d) setMenu(d);
      })
      .catch(() => {});
    return () => {
      off = true;
    };
  }, [tab, menu, tableCode]);

  const due = sheet ? Math.max(0, sheet.net - sheet.paid) : 0;

  return (
    <div
      role={page ? undefined : "dialog"}
      aria-modal={page ? undefined : "true"}
      aria-label={`${label} order details`}
      className={
        page
          ? "w-full"
          : "fixed inset-0 z-[90] flex items-end justify-center bg-slate-900/40 p-0 backdrop-blur-[2px] sm:items-center sm:p-4"
      }
      onMouseDown={(e) => {
        if (!page && e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className={
          page
            ? "panel flex w-full max-w-3xl flex-col"
            : "animate-[dialogIn_.16s_ease-out] flex max-h-[92dvh] w-full max-w-lg flex-col overflow-hidden rounded-t-3xl bg-white shadow-2xl ring-1 ring-slate-200 sm:rounded-3xl"
        }
      >
        <header className="flex items-start justify-between gap-3 border-b border-slate-200 px-5 py-4">
          <div className="min-w-0">
            <h2 className="font-display text-lg font-semibold text-slate-900">{label}</h2>
            <p className="text-[11px] text-slate-500">
              {sheet
                ? sheet.billNo
                  ? `Bill ${sheet.billNo} · ${sheet.rounds.length} round${sheet.rounds.length === 1 ? "" : "s"}`
                  : `${sheet.rounds.length} round${sheet.rounds.length === 1 ? "" : "s"} · no bill raised yet`
                : "Loading…"}
            </p>
          </div>
          <span className="flex shrink-0 items-center gap-2">
            {tableCode && (
              <span className="flex rounded-full bg-slate-100 p-0.5">
                {(["details", "menu"] as const).map((k) => (
                  <button
                    key={k}
                    onClick={() => setTab(k)}
                    className={`rounded-full px-3 py-1 text-[11px] font-bold transition ${
                      tab === k ? "bg-white text-slate-900 shadow-sm" : "text-slate-500"
                    }`}
                  >
                    {k === "details" ? "Details" : "Menu"}
                  </button>
                ))}
              </span>
            )}
            <button
              onClick={onClose}
              aria-label={page ? "Back" : "Close"}
              className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-slate-100 text-sm text-slate-500"
            >
              {page ? "←" : "✕"}
            </button>
          </span>
        </header>

        <div className={`px-5 py-4 ${page ? "" : "min-h-0 flex-1 overflow-y-auto"}`}>
          {tab === "menu" && tableCode ? (
            menu ? (
              <OrderPad
                embedded
                tableCode={tableCode}
                tableLabel={label}
                categories={menu.categories}
                items={menu.items}
                onPlaced={() => {
                  setTab("details");
                  load();
                }}
              />
            ) : (
              <p className="text-xs text-slate-400">Loading the menu…</p>
            )
          ) : (
          <>
          {error && <p className="text-xs text-rose-600">Could not load this table.</p>}
          {!sheet && !error && <p className="text-xs text-slate-400">Loading…</p>}

          {sheet?.rounds.map((r, i) => (
            <section key={r.id} className="mb-4">
              <div className="mb-1.5 flex items-baseline justify-between">
                <h3 className="text-[10px] font-bold tracking-widest text-slate-400 uppercase">
                  Round {i + 1}
                  {r.placedBy ? ` · ${r.placedBy}` : ""}
                  {r.placedVia === "anna" ? " · 🎙️" : ""}
                </h3>
                <span className="text-[11px] font-semibold text-slate-500">
                  {inr(r.totalInr)}
                </span>
              </div>
              <ul className="flex flex-col gap-1">
                {r.items.map((it) => {
                  const m = ITEM_MARK[it.status] ?? ITEM_MARK.queued;
                  return (
                    <li
                      key={it.id}
                      className="flex items-center justify-between gap-2 rounded-lg bg-slate-50 px-2.5 py-1.5 text-xs"
                    >
                      <span
                        className={`min-w-0 truncate ${
                          it.status === "cancelled"
                            ? "text-slate-400 line-through"
                            : "text-slate-700"
                        }`}
                      >
                        {it.qty}× {it.name}
                      </span>
                      <span className="flex shrink-0 items-center gap-2">
                        <span className={`text-[11px] ${m.cls}`}>
                          {m.icon} {it.status}
                        </span>
                        {onCancelItem && it.status !== "cancelled" && it.status !== "served" && (
                          <button
                            onClick={async () => {
                              await onCancelItem(it.id, it.name);
                              load();
                            }}
                            title={`Remove ${it.name} from the bill`}
                            className="grid h-5 w-5 place-items-center rounded-full bg-white text-[10px] text-rose-600 ring-1 ring-rose-200 transition active:scale-90"
                          >
                            ✕
                          </button>
                        )}
                      </span>
                    </li>
                  );
                })}
              </ul>
            </section>
          ))}

          {sheet && sheet.rounds.length === 0 && (
            <p className="text-xs text-slate-400">Nothing ordered yet.</p>
          )}

          {sheet && sheet.rounds.length > 0 && (
            <dl className="mt-2 border-t border-slate-200 pt-3 text-xs">
              <Row label="Items" value={inr(sheet.gross)} />
              {sheet.discount > 0 && (
                <Row
                  label={`Discount (${sheet.discountPct}%)`}
                  value={`− ${inr(sheet.discount)}`}
                  tone="text-emerald-700"
                />
              )}
              <Row label="GST" value={inr(sheet.gst)} />
              {!sheet.serviceWaived && sheet.service > 0 && (
                <Row label={`Service (${sheet.serviceChargePct}%)`} value={inr(sheet.service)} />
              )}
              {sheet.serviceWaived && (
                <Row label="Service charge" value="waived" tone="text-slate-400" />
              )}
              {sheet.tip > 0 && <Row label="Tip" value={inr(sheet.tip)} />}
              <div className="mt-2 flex items-baseline justify-between border-t border-slate-200 pt-2">
                <dt className="text-[10px] font-bold tracking-widest text-slate-400 uppercase">
                  Total
                </dt>
                <dd className="font-display text-xl font-semibold text-slate-900">
                  {inr(sheet.net)}
                </dd>
              </div>
              {sheet.paid > 0 && (
                <>
                  <Row label="Paid" value={inr(sheet.paid)} tone="text-emerald-700" />
                  <Row
                    label="Still due"
                    value={inr(due)}
                    tone={due > 0 ? "font-bold text-rose-600" : "text-emerald-700"}
                  />
                </>
              )}
            </dl>
          )}
          </>
          )}
        </div>

        <footer className="flex flex-wrap gap-2 border-t border-slate-200 px-5 py-4">
          <a
            href={`/bill/${sessionId}`}
            target="_blank"
            className="rounded-xl bg-slate-100 px-4 py-2.5 text-xs font-bold text-slate-600"
          >
            🧾 Print view
          </a>
          {onShare && sheet && (
            <button
              onClick={() => onShare(sheet.net)}
              className="rounded-xl bg-white text-slate-700 ring-1 ring-slate-300 hover:bg-slate-50 px-4 py-2.5 text-xs font-bold  transition active:scale-[0.98]"
            >
              Share on WhatsApp
            </button>
          )}
          {actions}
        </footer>
      </div>
    </div>
  );
}

function Row({ label, value, tone }: { label: string; value: string; tone?: string }) {
  return (
    <div className="flex items-baseline justify-between py-0.5">
      <dt className="text-slate-500">{label}</dt>
      <dd className={tone ?? "text-slate-700"}>{value}</dd>
    </div>
  );
}

// Opens WhatsApp with the bill link ready to send. The guest's number is
// optional — without one WhatsApp just asks who to send it to.
export async function shareBillOnWhatsApp(opts: {
  sessionId: string;
  label: string;
  net: number;
}) {
  const number = await ask.prompt({
    title: `Share ${opts.label}'s bill`,
    message: "Leave it blank to pick the contact in WhatsApp yourself.",
    label: "Guest's WhatsApp number",
    placeholder: "10-digit mobile, optional",
    inputMode: "numeric",
    confirmLabel: "Open WhatsApp",
  });
  if (number === null) return;

  const digits = number.replace(/\D/g, "");
  // a bare 10-digit Indian mobile needs its country code for wa.me
  const to = digits ? (digits.length === 10 ? `91${digits}` : digits) : "";
  const link = `${window.location.origin}/bill/${opts.sessionId}`;
  const text = `Your bill at ${opts.label} — ${inr(opts.net)}\n${link}`;
  window.open(
    `https://wa.me/${to}?text=${encodeURIComponent(text)}`,
    "_blank",
    "noopener,noreferrer",
  );
}
