import { useMemo, useRef, useState } from "react";
import { inr, type CartLine } from "@narada/shared";
import type { WaiterMenuResponse } from "@/api/hooks";
import { usePlaceOrder, useWaiterDictate } from "@/api/hooks";

function audioToBase64(blob: Blob): Promise<string> {
  return blob.arrayBuffer().then((buffer) => {
    const bytes = new Uint8Array(buffer);
    let binary = "";
    for (let offset = 0; offset < bytes.length; offset += 0x8000) {
      binary += String.fromCharCode(...bytes.subarray(offset, offset + 0x8000));
    }
    return btoa(binary);
  });
}

export default function StaffOrderPad({
  outletSlug,
  tableCode,
  sessionId,
  menu,
  onPlaced,
}: {
  outletSlug: string;
  tableCode: string;
  sessionId: string;
  menu: WaiterMenuResponse;
  onPlaced: () => void;
}) {
  const [cart, setCart] = useState<CartLine[]>([]);
  const [category, setCategory] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [listening, setListening] = useState(false);
  const [heard, setHeard] = useState<string | null>(null);
  const [unmatched, setUnmatched] = useState<string[]>([]);
  const [readBack, setReadBack] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const recorder = useRef<MediaRecorder | null>(null);
  const place = usePlaceOrder();
  const dictate = useWaiterDictate();
  const items = useMemo(
    () =>
      menu.items.filter(
        (item) =>
          (!category || item.categoryId === category) &&
          item.name.toLowerCase().includes(query.trim().toLowerCase()),
      ),
    [menu.items, category, query],
  );
  const count = cart.reduce((total, line) => total + line.qty, 0);
  const total = cart.reduce(
    (sum, line) =>
      sum + (menu.items.find((item) => item.id === line.itemId)?.priceInr ?? 0) * line.qty,
    0,
  );

  const add = (itemId: string, qty = 1) =>
    setCart((current) => {
      const found = current.find((line) => line.itemId === itemId);
      if (!found) return qty > 0 ? [...current, { itemId, qty }] : current;
      const nextQty = found.qty + qty;
      return nextQty > 0
        ? current.map((line) => (line.itemId === itemId ? { ...line, qty: nextQty } : line))
        : current.filter((line) => line.itemId !== itemId);
    });

  const listen = async () => {
    if (listening) {
      recorder.current?.stop();
      return;
    }
    setError(null);
    setHeard(null);
    setUnmatched([]);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const chunks: BlobPart[] = [];
      const next = new MediaRecorder(stream);
      recorder.current = next;
      next.ondataavailable = (event) => {
        if (event.data.size > 0) chunks.push(event.data);
      };
      next.onstop = async () => {
        stream.getTracks().forEach((track) => track.stop());
        setListening(false);
        try {
          const result = await dictate.mutateAsync({
            tableCode,
            audio: await audioToBase64(new Blob(chunks, { type: next.mimeType || "audio/webm" })),
          });
          setHeard(result.transcript);
          setUnmatched(result.unmatched);
          result.lines.forEach((line) => add(line.itemId, line.qty));
          setReadBack(true);
        } catch {
          setError("Could not read that back. Try again or use search.");
        }
      };
      next.start();
      setListening(true);
    } catch {
      setError("Microphone access is unavailable. Use menu search instead.");
    }
  };

  const placeOrder = async () => {
    if (cart.length === 0 || place.isPending) return;
    setError(null);
    try {
      await place.mutateAsync({
        outletSlug,
        tableCode,
        sessionId,
        serviceType: "dine_in",
        cart,
        placedVia: "waiter",
        guestName: "",
        lang: "en",
      });
      setCart([]);
      setHeard(null);
      setUnmatched([]);
      onPlaced();
    } catch {
      setError("Could not send this round. Your cart is still here.");
    }
  };

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-2">
        <label className="flex min-w-0 flex-1 items-center gap-2 rounded-xl bg-white px-3 py-2 ring-1 ring-slate-200">
          <span aria-hidden="true">⌕</span>
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search the menu…"
            className="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-slate-400"
          />
        </label>
        <button
          onClick={listen}
          aria-label={listening ? "Stop dictation" : "Dictate order"}
          className={`grid h-10 w-10 shrink-0 place-items-center rounded-full text-lg ${listening ? "bg-rose-600 text-white" : "bg-white text-slate-700 ring-1 ring-slate-200"}`}
        >
          {listening ? "■" : "🎙️"}
        </button>
      </div>
      {heard && (
        <p className="rounded-lg bg-sky-50 px-3 py-2 text-xs font-semibold text-sky-800">
          Heard: “{heard}”
        </p>
      )}
      {unmatched.length > 0 && (
        <p className="rounded-lg bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-800">
          Not found: {unmatched.join(", ")}
        </p>
      )}
      {error && (
        <p className="rounded-lg bg-rose-50 px-3 py-2 text-xs font-semibold text-rose-700">
          {error}
        </p>
      )}
      <div className="no-scrollbar flex gap-1.5 overflow-x-auto">
        <button
          onClick={() => setCategory(null)}
          className={`shrink-0 rounded-full px-3 py-1.5 text-xs font-bold ${category === null ? "bg-slate-900 text-white" : "bg-slate-100 text-slate-600"}`}
        >
          Everything
        </button>
        {menu.categories.map((item) => (
          <button
            key={item.id}
            onClick={() => setCategory(item.id === category ? null : item.id)}
            className={`shrink-0 rounded-full px-3 py-1.5 text-xs font-bold ${category === item.id ? "bg-slate-900 text-white" : "bg-slate-100 text-slate-600"}`}
          >
            {item.emoji} {item.name}
          </button>
        ))}
      </div>
      <div className="grid gap-2 sm:grid-cols-2">
        {items.map((item) => (
          <div
            key={item.id}
            className={`flex items-center justify-between rounded-xl bg-white px-3 py-3 text-left ring-1 ring-slate-200 ${!item.isAvailable ? "opacity-45" : ""}`}
          >
            <span>
              <span className="block text-sm font-semibold text-slate-800">
                {item.emoji} {item.name}
              </span>
              <span className="text-xs text-slate-500">
                {inr(item.priceInr)}
                {!item.isAvailable && " · sold out"}
              </span>
            </span>
            {item.isAvailable && (cart.find((line) => line.itemId === item.id)?.qty ?? 0) > 0 ? (
              <span className="flex shrink-0 items-center gap-1.5">
                <button
                  onClick={() => add(item.id, -1)}
                  aria-label={`one less ${item.name}`}
                  className="grid h-8 w-8 place-items-center rounded-full bg-slate-100 text-sm font-bold text-slate-600"
                >
                  −
                </button>
                <span className="w-5 text-center text-sm font-bold tabular-nums">
                  {cart.find((line) => line.itemId === item.id)?.qty}
                </span>
                <button
                  onClick={() => add(item.id)}
                  aria-label={`one more ${item.name}`}
                  className="grid h-8 w-8 place-items-center rounded-full bg-white text-sm font-bold text-slate-700 ring-1 ring-slate-300"
                >
                  +
                </button>
              </span>
            ) : item.isAvailable ? (
              <button
                onClick={() => add(item.id)}
                className="shrink-0 rounded-full bg-slate-100 px-2.5 py-1 text-xs font-bold text-slate-700"
              >
                Add
              </button>
            ) : null}
          </div>
        ))}
      </div>
      {readBack && cart.length > 0 && (
        <div className="rounded-xl bg-slate-50 p-3 text-xs text-slate-700">
          <div className="flex items-center justify-between">
            <span className="font-bold">Round to send</span>
            <button onClick={() => setReadBack(false)} className="font-semibold text-slate-500">
              Hide
            </button>
          </div>
          <p className="mt-1">
            {cart
              .map(
                (line) =>
                  `${line.qty}× ${menu.items.find((item) => item.id === line.itemId)?.name ?? "item"}`,
              )
              .join(", ")}
          </p>
        </div>
      )}
      {count > 0 && (
        <div className="sticky bottom-0 flex items-center gap-3 border-t border-slate-200 bg-white/95 p-3 backdrop-blur">
          <button
            onClick={() => setReadBack((value) => !value)}
            className="min-w-0 flex-1 truncate text-left text-xs font-semibold text-slate-600 underline"
          >
            {readBack
              ? "Hide the list"
              : cart
                  .map(
                    (line) =>
                      `${line.qty}× ${menu.items.find((item) => item.id === line.itemId)?.name ?? "item"}`,
                  )
                  .join(", ")}
          </button>
          <span className="font-display text-lg font-semibold tabular-nums">{inr(total)}</span>
          <button
            onClick={() => {
              setCart([]);
              setReadBack(false);
            }}
            className="rounded-full bg-slate-100 px-3 py-2 text-xs font-bold text-slate-600"
          >
            Clear
          </button>
          <button
            onClick={placeOrder}
            disabled={place.isPending}
            className="rounded-full bg-slate-900 px-4 py-2 text-xs font-bold text-white disabled:opacity-50"
          >
            {place.isPending ? "Sending…" : "Send to kitchen"}
          </button>
        </div>
      )}
    </div>
  );
}
