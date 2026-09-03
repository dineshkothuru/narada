import { inr, type STRINGS } from "@narada/shared";
import type { OrderRound } from "@/api/hooks";

type Strings = (typeof STRINGS)["en"];

export function statusLabelFor(status: string, t: Strings) {
  return status === "served"
    ? t.statusServed
    : status === "ready"
      ? t.statusReady
      : status === "preparing"
        ? t.statusPreparing
        : status === "queued"
          ? t.inQueue
          : t.statusPlaced;
}

export function statusDotFor(status: string) {
  return status === "served"
    ? "bg-green-400"
    : status === "ready"
      ? "bg-amber-400"
      : status === "preparing"
        ? "bg-sky-400"
        : status === "queued"
          ? "bg-stone-400"
          : "bg-rose-400";
}

export function statusEmojiFor(status: string) {
  return status === "served"
    ? "✅"
    : status === "ready"
      ? "🔔"
      : status === "preparing"
        ? "👨‍🍳"
        : "⏳";
}

// Per-dish chips for the marquee under the sticky banner: a "3 of 7 served"
// summary followed by every dish on the table.
export function dishChipsFor(rounds: OrderRound[], t: Strings) {
  const all = rounds.flatMap((r) =>
    r.items.map((it) => ({ text: `${it.qty}× ${it.name}`, status: it.status ?? r.status })),
  );
  if (all.length === 0) return [];
  const servedCount = all.filter((x) => x.status === "served").length;
  return [
    {
      text: t.servedOf.replace("{a}", String(servedCount)).replace("{b}", String(all.length)),
      status: servedCount === all.length ? "served" : "preparing",
    },
    ...all,
  ];
}

// The sticky banner: live kitchen progress plus the pay affordance.
export function OrderBanner({
  t,
  allServed,
  statusLabel,
  orderStatus,
  payableText,
  chips,
  onOpen,
}: {
  t: Strings;
  allServed: boolean;
  statusLabel: string;
  orderStatus: string;
  payableText: string;
  chips: { text: string; status: string }[];
  onOpen: () => void;
}) {
  return (
    <button onClick={onOpen} className="block w-full bg-stone-900 px-4 py-2.5 text-left">
      <span className="flex items-center justify-between gap-2">
        <span className="flex items-center gap-2 text-xs font-bold text-white">
          <span
            className={`h-2 w-2 rounded-full ${
              allServed ? "bg-green-400" : `animate-pulse ${statusDotFor(orderStatus)}`
            }`}
          />
          {allServed ? t.allServed : statusLabel}
        </span>
        <span className="shrink-0 rounded-full bg-rose-600 px-3 py-1 text-[11px] font-extrabold text-white">
          {payableText} ›
        </span>
      </span>
      {chips.length > 1 && !allServed && (
        // continuously scrolling per-dish progress strip
        <span className="mt-1.5 block overflow-hidden">
          <span className="animate-marquee flex w-max gap-5">
            {[...chips, ...chips].map((c, i) => (
              <span
                key={i}
                className="flex items-center gap-1 text-[10px] font-semibold whitespace-nowrap text-stone-300"
              >
                {statusEmojiFor(c.status)} {c.text}
              </span>
            ))}
          </span>
        </span>
      )}
    </button>
  );
}

// The per-round breakdown inside the order sheet, once the kitchen has tickets.
export function RoundList({
  rounds,
  myOrderIds,
  t,
}: {
  rounds: OrderRound[];
  myOrderIds: string[];
  t: Strings;
}) {
  return (
    <div className="mt-4 w-full space-y-2">
      {rounds.map((r, i) => (
        <div key={r.id} className="rounded-xl bg-stone-50 px-3.5 py-2.5 text-xs">
          <div className="flex items-center justify-between font-bold text-stone-500">
            <span>
              {t.round} {i + 1} {Number(r.total_inr) === 0 && "🎁"}
              {(myOrderIds.includes(r.id) || r.placed_by) && (
                <span
                  className={`ml-1.5 rounded px-1.5 py-0.5 text-[10px] font-extrabold ${
                    myOrderIds.includes(r.id)
                      ? "bg-rose-100 text-rose-700"
                      : "bg-stone-200 text-stone-600"
                  }`}
                >
                  {myOrderIds.includes(r.id) ? t.you : r.placed_by}
                </span>
              )}
            </span>
            <span>{Number(r.total_inr) > 0 ? inr(Number(r.total_inr)) : ""}</span>
          </div>
          <div className="mt-1.5 space-y-1">
            {r.items.map((it, j) => (
              <div key={j} className="flex items-center justify-between">
                <span className="flex min-w-0 items-center gap-2 font-semibold text-stone-700">
                  <span
                    className={`h-2 w-2 shrink-0 rounded-full ${statusDotFor(it.status ?? r.status)} ${
                      (it.status ?? r.status) !== "served" ? "animate-pulse" : ""
                    }`}
                  />
                  <span className="truncate">
                    {it.qty}× {it.name}
                  </span>
                </span>
                <span className="ml-2 shrink-0 text-stone-500">
                  {statusLabelFor(it.status ?? r.status, t)}
                </span>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
