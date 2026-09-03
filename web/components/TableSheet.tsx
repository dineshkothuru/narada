"use client";

import { useCallback, useEffect, useState } from "react";
import { inr } from "@/lib/format";
import { ask } from "./Dialogs";

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
  queued: { icon: "⏳", cls: "text-stone-400" },
  preparing: { icon: "👨‍🍳", cls: "text-sky-600" },
  ready: { icon: "🔔", cls: "font-semibold text-amber-600" },
  served: { icon: "✅", cls: "text-green-600" },
  cancelled: { icon: "✕", cls: "text-stone-400" },
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
  actions,
}: {
  sessionId: string;
  label: string;
  onClose: () => void;
  onShare?: (net: number) => void;
  /** staff only — voids a dish and takes it off the bill */
  onCancelItem?: (itemId: string, name: string) => Promise<void> | void;
  actions?: React.ReactNode;
}) {
  const [sheet, setSheet] = useState<Sheet | null>(null);
  const [error, setError] = useState(false);

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
  }, [onClose]);

  const due = sheet ? Math.max(0, sheet.net - sheet.paid) : 0;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`${label} order details`}
      className="fixed inset-0 z-[90] flex items-end justify-center bg-stone-900/40 p-0 backdrop-blur-[2px] sm:items-center sm:p-4"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="animate-[dialogIn_.16s_ease-out] flex max-h-[92dvh] w-full max-w-lg flex-col overflow-hidden rounded-t-3xl bg-white shadow-2xl ring-1 ring-stone-200 sm:rounded-3xl">
        <header className="flex items-start justify-between gap-3 border-b border-stone-200 px-5 py-4">
          <div className="min-w-0">
            <h2 className="font-display text-lg font-semibold text-stone-900">{label}</h2>
            <p className="text-[11px] text-stone-500">
              {sheet
                ? sheet.billNo
                  ? `Bill ${sheet.billNo} · ${sheet.rounds.length} round${sheet.rounds.length === 1 ? "" : "s"}`
                  : `${sheet.rounds.length} round${sheet.rounds.length === 1 ? "" : "s"} · no bill raised yet`
                : "Loading…"}
            </p>
          </div>
          <button
            onClick={onClose}
            aria-label="Close"
            className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-stone-100 text-sm text-stone-500"
          >
            ✕
          </button>
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
          {error && <p className="text-xs text-rose-600">Could not load this table.</p>}
          {!sheet && !error && <p className="text-xs text-stone-400">Loading…</p>}

          {sheet?.rounds.map((r, i) => (
            <section key={r.id} className="mb-4">
              <div className="mb-1.5 flex items-baseline justify-between">
                <h3 className="text-[10px] font-bold tracking-widest text-stone-400 uppercase">
                  Round {i + 1}
                  {r.placedBy ? ` · ${r.placedBy}` : ""}
                  {r.placedVia === "anna" ? " · 🎙️" : ""}
                </h3>
                <span className="text-[11px] font-semibold text-stone-500">
                  {inr(r.totalInr)}
                </span>
              </div>
              <ul className="flex flex-col gap-1">
                {r.items.map((it) => {
                  const m = ITEM_MARK[it.status] ?? ITEM_MARK.queued;
                  return (
                    <li
                      key={it.id}
                      className="flex items-center justify-between gap-2 rounded-lg bg-stone-50 px-2.5 py-1.5 text-xs"
                    >
                      <span
                        className={`min-w-0 truncate ${
                          it.status === "cancelled"
                            ? "text-stone-400 line-through"
                            : "text-stone-700"
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
            <p className="text-xs text-stone-400">Nothing ordered yet.</p>
          )}

          {sheet && sheet.rounds.length > 0 && (
            <dl className="mt-2 border-t border-stone-200 pt-3 text-xs">
              <Row label="Items" value={inr(sheet.gross)} />
              {sheet.discount > 0 && (
                <Row
                  label={`Discount (${sheet.discountPct}%)`}
                  value={`− ${inr(sheet.discount)}`}
                  tone="text-green-700"
                />
              )}
              <Row label="GST" value={inr(sheet.gst)} />
              {!sheet.serviceWaived && sheet.service > 0 && (
                <Row label={`Service (${sheet.serviceChargePct}%)`} value={inr(sheet.service)} />
              )}
              {sheet.serviceWaived && (
                <Row label="Service charge" value="waived" tone="text-stone-400" />
              )}
              {sheet.tip > 0 && <Row label="Tip" value={inr(sheet.tip)} />}
              <div className="mt-2 flex items-baseline justify-between border-t border-stone-200 pt-2">
                <dt className="text-[10px] font-bold tracking-widest text-stone-400 uppercase">
                  Total
                </dt>
                <dd className="font-display text-xl font-semibold text-stone-900">
                  {inr(sheet.net)}
                </dd>
              </div>
              {sheet.paid > 0 && (
                <>
                  <Row label="Paid" value={inr(sheet.paid)} tone="text-green-700" />
                  <Row
                    label="Still due"
                    value={inr(due)}
                    tone={due > 0 ? "font-bold text-rose-600" : "text-green-700"}
                  />
                </>
              )}
            </dl>
          )}
        </div>

        <footer className="flex flex-wrap gap-2 border-t border-stone-200 px-5 py-4">
          <a
            href={`/bill/${sessionId}`}
            target="_blank"
            className="rounded-xl bg-stone-100 px-4 py-2.5 text-xs font-bold text-stone-600"
          >
            🧾 Print view
          </a>
          {onShare && sheet && (
            <button
              onClick={() => onShare(sheet.net)}
              className="rounded-xl bg-green-600 px-4 py-2.5 text-xs font-bold text-white transition active:scale-[0.98]"
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
      <dt className="text-stone-500">{label}</dt>
      <dd className={tone ?? "text-stone-700"}>{value}</dd>
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
