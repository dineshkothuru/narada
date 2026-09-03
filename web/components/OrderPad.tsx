"use client";

import { useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { inr } from "@/lib/format";
import { ask } from "./Dialogs";

type Cat = { id: string; name: string; emoji: string };
type Item = {
  id: string;
  categoryId: string;
  name: string;
  priceInr: number;
  isVeg: boolean;
  isAvailable: boolean;
  emoji: string;
};

// Built for someone standing at a table with a queue behind them: the whole
// menu on one screen, a search that filters as you type, and a microphone for
// when it is faster to repeat what was just said than to hunt for it.
export default function OrderPad({
  tableCode,
  tableLabel,
  categories,
  items,
}: {
  tableCode: string;
  tableLabel: string;
  categories: Cat[];
  items: Item[];
}) {
  const router = useRouter();
  const [cart, setCart] = useState<Record<string, number>>({});
  const [query, setQuery] = useState("");
  const [cat, setCat] = useState<string | null>(null);
  const [listening, setListening] = useState(false);
  const [heard, setHeard] = useState<string | null>(null);
  const [missed, setMissed] = useState<string[]>([]);
  const [placing, setPlacing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);

  const byId = useMemo(() => new Map(items.map((i) => [i.id, i])), [items]);

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    return items.filter(
      (i) =>
        (!cat || i.categoryId === cat) &&
        (!q || i.name.toLowerCase().includes(q)),
    );
  }, [items, cat, query]);

  const lines = Object.entries(cart)
    .map(([id, qty]) => ({ item: byId.get(id)!, qty }))
    .filter((l) => l.item);
  const total = lines.reduce((n, l) => n + l.item.priceInr * l.qty, 0);
  const count = lines.reduce((n, l) => n + l.qty, 0);

  const add = (id: string, by = 1) =>
    setCart((c) => {
      const next = Math.max(0, (c[id] ?? 0) + by);
      const { [id]: _drop, ...rest } = c;
      void _drop;
      return next === 0 ? rest : { ...rest, [id]: next };
    });

  // Speaking the order. The server does the hearing and the matching; anything
  // it could not place on the menu comes back so the waiter can see the gap
  // rather than discovering it at the pass.
  const listen = async () => {
    if (listening) {
      recorderRef.current?.stop();
      return;
    }
    setError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const rec = new MediaRecorder(stream);
      const chunks: Blob[] = [];
      recorderRef.current = rec;
      rec.ondataavailable = (e) => chunks.push(e.data);
      rec.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop());
        setListening(false);
        const blob = new Blob(chunks, { type: "audio/webm" });
        const buf = await blob.arrayBuffer();
        const b64 = btoa(String.fromCharCode(...new Uint8Array(buf)));
        try {
          const res = await fetch("/api/waiter/dictate", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ tableCode, audio: b64 }),
          });
          const d = await res.json();
          if (!res.ok) {
            setError(d.error ?? "Could not read that back");
            return;
          }
          setHeard(d.transcript);
          setMissed(d.unmatched ?? []);
          setCart((c) => {
            const next = { ...c };
            for (const l of d.lines ?? []) {
              next[l.itemId] = (next[l.itemId] ?? 0) + l.qty;
            }
            return next;
          });
        } catch {
          setError("Could not read that back");
        }
      };
      rec.start();
      setListening(true);
    } catch {
      setError("No microphone on this device");
    }
  };

  const place = async () => {
    if (lines.length === 0) return;
    const who = await ask.prompt({
      title: `Send ${count} item${count === 1 ? "" : "s"} to the kitchen`,
      message: `${tableLabel} · ${inr(total)}`,
      label: "Ordered for (optional)",
      placeholder: "guest's name",
      confirmLabel: "Send to kitchen",
    });
    if (who === null) return;

    setPlacing(true);
    setError(null);
    try {
      const res = await fetch("/api/order", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tableCode,
          cart: lines.map((l) => ({ itemId: l.item.id, qty: l.qty })),
          placedVia: "waiter",
          guestName: who || undefined,
        }),
      });
      const d = await res.json();
      if (!res.ok) {
        setError(d.error ?? "Could not send that");
        return;
      }
      ask.toast(`Sent to the kitchen · ${tableLabel}`);
      setCart({});
      setHeard(null);
      setMissed([]);
      router.push("/waiter");
    } finally {
      setPlacing(false);
    }
  };

  return (
    <div className="flex max-w-6xl flex-col gap-3 pb-28">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-semibold text-slate-900">
            Order for {tableLabel}
          </h1>
          <p className="text-xs text-slate-500">
            Tap to add, or hold the mic and say it — it goes in as a normal round.
            {error && <span className="ml-2 font-semibold text-rose-600">{error}</span>}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={listen}
            className={`rounded-full px-5 py-2.5 text-xs font-bold transition active:scale-95 ${
              listening
                ? "animate-pulse bg-rose-600 text-white"
                : "bg-indigo-600 text-white"
            }`}
          >
            {listening ? "⏹ Stop" : "🎙️ Speak the order"}
          </button>
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search the menu…"
            className="w-44 rounded-full bg-white px-4 py-2.5 text-xs font-semibold ring-1 ring-slate-200 outline-none focus:ring-2 focus:ring-indigo-400"
          />
        </div>
      </header>

      {heard && (
        <div className="tone-violet panel p-3">
          <p className="text-xs text-slate-700">
            <span className="font-bold text-violet-700">Heard:</span> {heard}
          </p>
          {missed.length > 0 && (
            <p className="mt-1 text-[11px] font-semibold text-amber-700">
              Not on the menu: {missed.join(", ")} — add it by hand if you need to.
            </p>
          )}
        </div>
      )}

      <div className="flex flex-wrap gap-1.5">
        <button
          onClick={() => setCat(null)}
          className={`rounded-full px-3 py-1.5 text-xs font-bold ${
            cat === null ? "bg-indigo-600 text-white" : "bg-white text-slate-600 ring-1 ring-slate-200"
          }`}
        >
          Everything
        </button>
        {categories.map((c) => (
          <button
            key={c.id}
            onClick={() => setCat(c.id === cat ? null : c.id)}
            className={`rounded-full px-3 py-1.5 text-xs font-bold ${
              cat === c.id
                ? "bg-indigo-600 text-white"
                : "bg-white text-slate-600 ring-1 ring-slate-200"
            }`}
          >
            {c.emoji} {c.name}
          </button>
        ))}
      </div>

      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {shown.map((i) => {
          const qty = cart[i.id] ?? 0;
          return (
            <div
              key={i.id}
              className={`panel flex items-center gap-3 p-3 ${
                i.isAvailable ? "" : "opacity-50"
              } ${qty > 0 ? "ring-2 ring-indigo-400" : ""}`}
            >
              <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-slate-100 text-base">
                {i.emoji}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-semibold text-slate-800">
                  {i.name}
                </span>
                <span className="text-[11px] text-slate-500">
                  {inr(i.priceInr)}
                  {!i.isAvailable && " · sold out"}
                </span>
              </span>
              {i.isAvailable &&
                (qty > 0 ? (
                  <span className="flex shrink-0 items-center gap-1.5">
                    <button
                      onClick={() => add(i.id, -1)}
                      aria-label={`one less ${i.name}`}
                      className="grid h-8 w-8 place-items-center rounded-full bg-slate-100 text-sm font-bold text-slate-600"
                    >
                      −
                    </button>
                    <span className="w-5 text-center text-sm font-bold tabular-nums">
                      {qty}
                    </span>
                    <button
                      onClick={() => add(i.id, 1)}
                      aria-label={`one more ${i.name}`}
                      className="grid h-8 w-8 place-items-center rounded-full bg-indigo-600 text-sm font-bold text-white"
                    >
                      +
                    </button>
                  </span>
                ) : (
                  <button
                    onClick={() => add(i.id, 1)}
                    className="shrink-0 rounded-full bg-slate-900 px-4 py-1.5 text-xs font-bold text-white transition active:scale-95"
                  >
                    Add
                  </button>
                ))}
            </div>
          );
        })}
        {shown.length === 0 && (
          <p className="panel py-8 text-center text-xs text-slate-400 sm:col-span-2 lg:col-span-3">
            Nothing matches “{query}”.
          </p>
        )}
      </div>

      {count > 0 && (
        <div className="fixed inset-x-0 bottom-0 z-40 border-t border-slate-200 bg-white/95 p-3 backdrop-blur md:left-60">
          <div className="mx-auto flex max-w-6xl items-center gap-3 px-1">
            <span className="min-w-0 flex-1 truncate text-xs text-slate-600">
              {lines.map((l) => `${l.qty}× ${l.item.name}`).join(", ")}
            </span>
            <span className="font-display shrink-0 text-lg font-semibold text-slate-900 tabular-nums">
              {inr(total)}
            </span>
            <button
              onClick={() => setCart({})}
              className="shrink-0 rounded-full bg-slate-100 px-4 py-2.5 text-xs font-bold text-slate-600"
            >
              Clear
            </button>
            <button
              onClick={place}
              disabled={placing}
              className="shrink-0 rounded-full bg-indigo-600 px-5 py-2.5 text-xs font-bold text-white transition active:scale-95 disabled:opacity-60"
            >
              {placing ? "Sending…" : `Send ${count} to kitchen`}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
