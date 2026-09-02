"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { LANGS, LANG_NAME, STRINGS, type Lang } from "@/lib/i18n";
import { WHEEL } from "@/lib/games";
import MemoryGame from "./MemoryGame";
import SpinWheel from "./SpinWheel";
import type { AnnaResponse, CartLine, ChatMessage, MenuPayload } from "@/lib/types";

const CATEGORY_TILES = [
  "from-amber-100 to-orange-200",
  "from-orange-100 to-rose-200",
  "from-yellow-50 to-amber-200",
  "from-amber-100 to-yellow-200",
  "from-rose-100 to-pink-200",
  "from-sky-100 to-cyan-200",
];

const inr = (n: number) => `₹${n.toLocaleString("en-IN")}`;

function SpiceDots({ level }: { level: number }) {
  if (level === 0) return null;
  return (
    <span className="text-[10px] tracking-tight" aria-label={`spice level ${level}`}>
      {"🌶️".repeat(level)}
    </span>
  );
}

function VegMark({ isVeg }: { isVeg: boolean }) {
  return (
    <span
      className={`inline-flex h-3.5 w-3.5 items-center justify-center rounded-[3px] border ${
        isVeg ? "border-green-600" : "border-red-600"
      }`}
    >
      <span
        className={`h-1.5 w-1.5 rounded-full ${isVeg ? "bg-green-600" : "bg-red-600"}`}
      />
    </span>
  );
}

export default function OrderExperience({
  tableCode,
  menu,
}: {
  tableCode: string;
  menu: MenuPayload;
}) {
  const { restaurant, categories, items: menuItems } = menu;
  const [cart, setCart] = useState<CartLine[]>([]);
  const [lang, setLang] = useState<Lang>("en");
  const [hydrated, setHydrated] = useState(false);
  const [vegOnly, setVegOnly] = useState(false);
  const [activeCat, setActiveCat] = useState(categories[0]?.id ?? "");
  const [cartOpen, setCartOpen] = useState(false);
  const [chatOpen, setChatOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [draft, setDraft] = useState("");
  const [thinking, setThinking] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [orderPlaced, setOrderPlaced] = useState<{ total: number } | null>(null);
  const [wheelOpen, setWheelOpen] = useState(false);
  const [spinDone, setSpinDone] = useState(false);
  const [spinResult, setSpinResult] = useState<number | null>(null);
  const [gameOpen, setGameOpen] = useState(false);
  const [discountPct, setDiscountPct] = useState(0);
  const [compItem, setCompItem] = useState<string | null>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const sectionRefs = useRef<Record<string, HTMLElement | null>>({});
  const storageKey = `narada:${tableCode}`;

  const MENU_BY_ID = useMemo(
    () => new Map(menuItems.map((m) => [m.id, m])),
    [menuItems],
  );

  useEffect(() => {
    try {
      const saved = localStorage.getItem(storageKey);
      if (saved) {
        const s = JSON.parse(saved);
        if (Array.isArray(s.cart)) setCart(s.cart);
        if (Array.isArray(s.messages)) setMessages(s.messages);
        if (s.lang === "en" || s.lang === "hi" || s.lang === "te") setLang(s.lang);
        if (s.spinDone) setSpinDone(true);
        if (typeof s.discountPct === "number") setDiscountPct(s.discountPct);
      }
    } catch {}
    setHydrated(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [storageKey]);

  useEffect(() => {
    if (!hydrated) return;
    try {
      localStorage.setItem(
        storageKey,
        JSON.stringify({ cart, messages, lang, spinDone, discountPct }),
      );
    } catch {}
  }, [hydrated, cart, messages, lang, spinDone, discountPct, storageKey]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, thinking, chatOpen]);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 2200);
    return () => clearTimeout(t);
  }, [toast]);

  const total = useMemo(
    () =>
      cart.reduce((sum, l) => sum + (MENU_BY_ID.get(l.itemId)?.priceInr ?? 0) * l.qty, 0),
    [cart],
  );
  const itemCount = useMemo(() => cart.reduce((n, l) => n + l.qty, 0), [cart]);

  const qtyOf = (itemId: string) => cart.find((l) => l.itemId === itemId)?.qty ?? 0;
  const t = STRINGS[lang];

  const changeQty = (itemId: string, delta: number, notes?: string) => {
    setCart((prev) => {
      const line = prev.find((l) => l.itemId === itemId);
      if (!line) {
        return delta > 0 ? [...prev, { itemId, qty: delta, notes }] : prev;
      }
      const qty = line.qty + delta;
      if (qty <= 0) return prev.filter((l) => l.itemId !== itemId);
      return prev.map((l) =>
        l.itemId === itemId ? { ...l, qty, notes: notes ?? l.notes } : l,
      );
    });
  };

  const applyAnnaActions = (res: AnnaResponse) => {
    for (const a of res.actions) {
      const item = MENU_BY_ID.get(a.itemId);
      if (!item) continue;
      if (a.type === "add") {
        changeQty(a.itemId, Math.max(1, a.qty || 1), a.notes);
        setToast(`+ ${item.name[lang]} ×${Math.max(1, a.qty || 1)}`);
      } else if (a.type === "remove") {
        setCart((prev) => prev.filter((l) => l.itemId !== a.itemId));
        setToast(`− ${item.name[lang]}`);
      } else if (a.type === "set_qty") {
        setCart((prev) =>
          a.qty <= 0
            ? prev.filter((l) => l.itemId !== a.itemId)
            : prev.some((l) => l.itemId === a.itemId)
              ? prev.map((l) => (l.itemId === a.itemId ? { ...l, qty: a.qty } : l))
              : [...prev, { itemId: a.itemId, qty: a.qty }],
        );
      }
    }
    if (res.suggestCheckout) setCartOpen(true);
  };

  const sendToAnna = async (text: string) => {
    const trimmed = text.trim();
    if (!trimmed || thinking) return;
    const nextMessages: ChatMessage[] = [...messages, { role: "user", text: trimmed }];
    setMessages(nextMessages);
    setDraft("");
    setThinking(true);
    try {
      const res = await fetch("/api/anna", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: nextMessages,
          cart,
          language: LANG_NAME[lang],
          tableCode,
        }),
      });
      if (!res.ok) throw new Error(String(res.status));
      const data: AnnaResponse = await res.json();
      setMessages((m) => [...m, { role: "assistant", text: data.reply }]);
      applyAnnaActions(data);
    } catch {
      setMessages((m) => [
        ...m,
        {
          role: "assistant",
          text: "Sorry, I lost my train of thought — could you say that again?",
        },
      ]);
    } finally {
      setThinking(false);
    }
  };

  const placeOrder = () => {
    setOrderPlaced({ total });
    setCart([]);
    setCompItem(null);
    setGameOpen(false);
  };

  const onWheelResult = (idx: number) => {
    const reward = WHEEL[idx].reward;
    setSpinResult(idx);
    setSpinDone(true);
    if (reward.type === "discount") setDiscountPct(reward.pct);
  };

  const payable = orderPlaced
    ? Math.round(orderPlaced.total * (1 - discountPct / 100))
    : 0;

  const upiLink = orderPlaced
    ? `upi://pay?pa=${encodeURIComponent(restaurant.upiVpa)}&pn=${encodeURIComponent(
        restaurant.name,
      )}&am=${payable}&cu=INR&tn=${encodeURIComponent(`Narada ${tableCode}`)}`
    : "";

  const scrollToCat = (id: string) => {
    setActiveCat(id);
    sectionRefs.current[id]?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const tableLabel = menu.tableLabel;

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-md flex-col pb-36">
      {/* Hero header */}
      <header className="rounded-b-[2rem] bg-emerald-950 px-6 pt-10 pb-6 text-amber-50">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-[11px] font-medium tracking-[0.2em] text-amber-200/70 uppercase">
              {tableLabel} · {t.dineIn}
            </p>
            <h1 className="font-display mt-1 text-3xl font-semibold tracking-tight">
              {restaurant.name}
            </h1>
            <p className="mt-1 text-xs text-amber-100/60">{restaurant.tagline}</p>
          </div>
          <div className="flex flex-col items-end gap-2">
            <div className="flex rounded-full border border-amber-100/20 p-0.5">
              {LANGS.map((l) => (
                <button
                  key={l.code}
                  onClick={() => setLang(l.code)}
                  className={`rounded-full px-2.5 py-1 text-[11px] font-bold transition ${
                    lang === l.code
                      ? "bg-amber-400 text-stone-900"
                      : "text-amber-100/70"
                  }`}
                >
                  {l.label}
                </button>
              ))}
            </div>
            <button
              onClick={() => setVegOnly((v) => !v)}
              className={`flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-semibold transition ${
                vegOnly
                  ? "border-green-400 bg-green-500/20 text-green-300"
                  : "border-amber-100/20 text-amber-100/70"
              }`}
            >
              <VegMark isVeg /> {t.veg}
            </button>
          </div>
        </div>
        <button
          onClick={() => setChatOpen(true)}
          className="mt-5 flex w-full items-center gap-3 rounded-2xl bg-gradient-to-r from-amber-400 to-yellow-500 px-4 py-3.5 text-left shadow-lg shadow-emerald-950/40 transition active:scale-[0.98]"
        >
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-white/20 text-xl">
            🎙️
          </span>
          <span>
            <span className="block text-sm font-bold text-white">{t.talkToAnna}</span>
            <span className="block text-xs text-orange-100">{t.annaHint}</span>
          </span>
        </button>
      </header>

      {/* Category chips */}
      <nav className="no-scrollbar sticky top-0 z-20 flex gap-2 overflow-x-auto bg-[#f3f5f0]/95 px-4 py-3 backdrop-blur">
        {categories.map((c) => (
          <button
            key={c.id}
            onClick={() => scrollToCat(c.id)}
            className={`shrink-0 rounded-full px-4 py-2 text-xs font-semibold whitespace-nowrap transition ${
              activeCat === c.id
                ? "bg-emerald-950 text-amber-50 shadow"
                : "bg-white text-stone-600 ring-1 ring-stone-200"
            }`}
          >
            {c.emoji} {c.name[lang]}
          </button>
        ))}
      </nav>

      {/* Menu sections */}
      <main className="flex flex-col gap-8 px-4 pt-2">
        {!spinDone && !orderPlaced && (
          <button
            onClick={() => setWheelOpen(true)}
            className="flex items-center gap-3 rounded-3xl bg-gradient-to-r from-teal-700 to-emerald-600 px-4 py-3.5 text-left shadow-lg shadow-emerald-700/20 transition active:scale-[0.98]"
          >
            <span className="text-3xl">🎡</span>
            <span>
              <span className="block text-sm font-bold text-white">{t.spinBanner}</span>
              <span className="block text-xs text-emerald-100">{t.spinSub}</span>
            </span>
          </button>
        )}
        {discountPct > 0 && !orderPlaced && (
          <div className="rounded-2xl bg-amber-50 px-4 py-3 text-center text-xs font-bold text-amber-700 ring-1 ring-amber-300">
            🎉 {t.discountApplied.replace("{pct}", String(discountPct))}
          </div>
        )}
        {categories.map((cat, catIdx) => {
          const items = menuItems.filter(
            (m) => m.categoryId === cat.id && (!vegOnly || m.isVeg),
          );
          if (items.length === 0) return null;
          return (
            <section
              key={cat.id}
              ref={(el) => {
                sectionRefs.current[cat.id] = el;
              }}
              className="scroll-mt-16"
            >
              <h2 className="font-display mb-3 text-xl font-semibold text-stone-800">
                {cat.emoji} {cat.name[lang]}
              </h2>
              <div className="flex flex-col gap-3">
                {items.map((item) => {
                  const qty = qtyOf(item.id);
                  return (
                    <article
                      key={item.id}
                      className="flex gap-3 rounded-3xl bg-white p-3 shadow-sm ring-1 ring-stone-100"
                    >
                      <div
                        className={`grid h-20 w-20 shrink-0 place-items-center rounded-2xl bg-gradient-to-br text-4xl ${CATEGORY_TILES[catIdx % CATEGORY_TILES.length]}`}
                      >
                        {item.emoji}
                      </div>
                      <div className="flex min-w-0 flex-1 flex-col">
                        <div className="flex items-center gap-1.5">
                          <VegMark isVeg={item.isVeg} />
                          <h3 className="truncate text-sm font-bold text-stone-800">
                            {item.name[lang]}
                          </h3>
                          <SpiceDots level={item.spiceLevel} />
                        </div>
                        {item.tags.includes("bestseller") && (
                          <span className="mt-0.5 w-fit rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold text-amber-700">
                            {t.bestseller}
                          </span>
                        )}
                        <p className="mt-1 line-clamp-2 text-xs leading-snug text-stone-500">
                          {item.description[lang]}
                        </p>
                        <div className="mt-auto flex items-center justify-between pt-2">
                          <span className="text-sm font-bold text-stone-900">
                            {inr(item.priceInr)}
                          </span>
                          {qty === 0 ? (
                            <button
                              onClick={() => {
                                changeQty(item.id, 1);
                                setToast(`+ ${item.name[lang]}`);
                              }}
                              className="rounded-full bg-emerald-700 px-4 py-1.5 text-xs font-bold text-white shadow-sm transition active:scale-90"
                            >
                              {t.add}
                            </button>
                          ) : (
                            <div className="flex items-center gap-3 rounded-full bg-emerald-950 px-2 py-1 text-white">
                              <button
                                onClick={() => changeQty(item.id, -1)}
                                className="grid h-6 w-6 place-items-center text-lg leading-none active:scale-90"
                                aria-label="decrease"
                              >
                                −
                              </button>
                              <span className="min-w-4 text-center text-xs font-bold">
                                {qty}
                              </span>
                              <button
                                onClick={() => changeQty(item.id, 1)}
                                className="grid h-6 w-6 place-items-center text-lg leading-none active:scale-90"
                                aria-label="increase"
                              >
                                +
                              </button>
                            </div>
                          )}
                        </div>
                      </div>
                    </article>
                  );
                })}
              </div>
            </section>
          );
        })}
        <p className="pb-4 text-center text-[11px] text-stone-400">{t.footer}</p>
      </main>

      {/* Toast */}
      {toast && (
        <div className="animate-pop fixed bottom-40 left-1/2 z-40 -translate-x-1/2 rounded-full bg-emerald-950 px-4 py-2 text-xs font-semibold text-amber-50 shadow-lg">
          {toast}
        </div>
      )}

      {/* Floating cart bar */}
      {itemCount > 0 && !cartOpen && (
        <button
          onClick={() => setCartOpen(true)}
          className="animate-pop fixed bottom-5 left-1/2 z-30 flex w-[calc(100%-2.5rem)] max-w-md -translate-x-1/2 items-center justify-between rounded-2xl bg-emerald-950 px-5 py-4 text-white shadow-xl shadow-stone-900/30 transition active:scale-[0.98]"
        >
          <span className="text-sm font-semibold">
            {t.items(itemCount)} · {inr(total)}
          </span>
          <span className="flex items-center gap-1 text-sm font-bold text-amber-300">
            {t.viewCart}
          </span>
        </button>
      )}

      {/* Anna FAB */}
      {!chatOpen && (
        <button
          onClick={() => setChatOpen(true)}
          aria-label="Talk to Anna"
          className={`fixed right-5 z-30 grid h-14 w-14 place-items-center rounded-full bg-gradient-to-br from-amber-400 to-yellow-500 text-2xl shadow-xl shadow-amber-500/40 transition active:scale-90 ${
            itemCount > 0 ? "bottom-24" : "bottom-6"
          }`}
        >
          🎙️
        </button>
      )}

      {/* Spin wheel sheet */}
      {wheelOpen && (
        <div className="fixed inset-0 z-50 flex flex-col justify-end">
          <div
            className="animate-fade-in absolute inset-0 bg-emerald-950/60"
            onClick={() => setWheelOpen(false)}
          />
          <div className="animate-sheet-up relative flex flex-col items-center rounded-t-[2rem] bg-white px-5 pt-3 pb-10">
            <div className="mx-auto mb-4 h-1 w-10 rounded-full bg-stone-200" />
            <h2 className="font-display text-2xl font-semibold">{t.spinBanner}</h2>
            <p className="mb-5 text-xs text-stone-400">{t.spinSub}</p>
            <SpinWheel strings={{ spin: t.spin }} onResult={onWheelResult} />
            {spinResult !== null && (
              <>
                <div
                  className={`animate-pop mt-5 w-full rounded-2xl p-4 text-center text-sm font-semibold ${
                    WHEEL[spinResult].reward.type === "discount"
                      ? "bg-amber-50 text-amber-800 ring-1 ring-amber-300"
                      : "bg-stone-50 text-stone-500 ring-1 ring-stone-200"
                  }`}
                >
                  {WHEEL[spinResult].reward.type === "discount"
                    ? t.spinWin.replace(
                        "{pct}",
                        String(
                          WHEEL[spinResult].reward.type === "discount"
                            ? (WHEEL[spinResult].reward as { pct: number }).pct
                            : 0,
                        ),
                      )
                    : t.spinNone}
                </div>
                <button
                  onClick={() => setWheelOpen(false)}
                  className="mt-3 rounded-full bg-emerald-950 px-8 py-2.5 text-xs font-bold text-amber-50 transition active:scale-95"
                >
                  ✕
                </button>
              </>
            )}
          </div>
        </div>
      )}

      {/* Cart sheet */}
      {cartOpen && (
        <div className="fixed inset-0 z-50 flex flex-col justify-end">
          <div
            className="animate-fade-in absolute inset-0 bg-emerald-950/50"
            onClick={() => setCartOpen(false)}
          />
          <div className="animate-sheet-up relative max-h-[85dvh] overflow-y-auto rounded-t-[2rem] bg-white px-5 pt-3 pb-8">
            <div className="mx-auto mb-4 h-1 w-10 rounded-full bg-stone-200" />
            {orderPlaced ? (
              <div className="flex flex-col items-center py-6 text-center">
                <span className="animate-pop text-6xl">✅</span>
                <h2 className="font-display mt-4 text-2xl font-semibold">
                  {t.orderSent}
                </h2>
                <p className="mt-2 max-w-xs text-sm text-stone-500">
                  {tableLabel} · {inr(orderPlaced.total)}. {t.orderSentNote}
                </p>

                {!compItem && !gameOpen && (
                  <button
                    onClick={() => setGameOpen(true)}
                    className="mt-5 w-full rounded-2xl bg-gradient-to-r from-teal-700 to-emerald-600 px-5 py-4 text-left shadow-lg transition active:scale-[0.98]"
                  >
                    <span className="block text-sm font-bold text-white">
                      {t.playTitle}
                    </span>
                    <span className="block text-xs text-emerald-100">{t.playSub}</span>
                  </button>
                )}

                {!compItem && gameOpen && (
                  <div className="animate-pop mt-5 w-full">
                    <MemoryGame
                      strings={{
                        level: t.level,
                        moves: t.moves,
                        levelClear: t.levelClear,
                        nextLevel: t.nextLevel,
                      }}
                      onAllLevelsComplete={() => setCompItem("Gulab Jamun (2 pcs)")}
                    />
                  </div>
                )}

                {compItem && (
                  <div className="animate-pop mt-5 w-full rounded-2xl bg-amber-50 p-4 text-sm font-semibold text-amber-800 ring-1 ring-amber-300">
                    {t.quizWinComp.replace("{item}", compItem)}
                  </div>
                )}

                <a
                  href={upiLink}
                  className="mt-5 w-full rounded-2xl bg-gradient-to-r from-green-600 to-emerald-500 px-6 py-4 text-sm font-bold text-white shadow-lg transition active:scale-[0.98]"
                >
                  {t.payUpi.replace("{amount}", inr(payable))}
                  {discountPct > 0 && (
                    <span className="mt-0.5 block text-[11px] font-medium text-green-100">
                      <s>{inr(orderPlaced.total)}</s> ·{" "}
                      {t.discountApplied.replace("{pct}", String(discountPct))}
                    </span>
                  )}
                </a>
                <button
                  onClick={() => {
                    setOrderPlaced(null);
                    setCartOpen(false);
                  }}
                  className="mt-3 text-xs font-semibold text-stone-400"
                >
                  {t.payLater}
                </button>
              </div>
            ) : (
              <>
                <h2 className="font-display text-2xl font-semibold">{t.yourOrder}</h2>
                <p className="text-xs text-stone-400">
                  {tableLabel} · {t.payNote}
                </p>
                {cart.length === 0 ? (
                  <p className="py-10 text-center text-sm text-stone-400">
                    {t.emptyCart}
                  </p>
                ) : (
                  <div className="mt-4 flex flex-col gap-3">
                    {cart.map((line) => {
                      const item = MENU_BY_ID.get(line.itemId);
                      if (!item) return null;
                      return (
                        <div
                          key={line.itemId}
                          className="flex items-center gap-3 rounded-2xl bg-stone-50 p-3"
                        >
                          <span className="text-2xl">{item.emoji}</span>
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-sm font-semibold text-stone-800">
                              {item.name[lang]}
                            </p>
                            {line.notes && (
                              <p className="truncate text-[11px] text-emerald-700">
                                ✎ {line.notes}
                              </p>
                            )}
                            <p className="text-xs text-stone-400">
                              {inr(item.priceInr)} {t.each}
                            </p>
                          </div>
                          <div className="flex items-center gap-2.5 rounded-full bg-white px-2 py-1 ring-1 ring-stone-200">
                            <button
                              onClick={() => changeQty(line.itemId, -1)}
                              className="grid h-6 w-6 place-items-center text-lg leading-none text-stone-600 active:scale-90"
                            >
                              −
                            </button>
                            <span className="min-w-4 text-center text-xs font-bold">
                              {line.qty}
                            </span>
                            <button
                              onClick={() => changeQty(line.itemId, 1)}
                              className="grid h-6 w-6 place-items-center text-lg leading-none text-stone-600 active:scale-90"
                            >
                              +
                            </button>
                          </div>
                          <span className="w-14 text-right text-sm font-bold">
                            {inr(item.priceInr * line.qty)}
                          </span>
                        </div>
                      );
                    })}
                    <div className="mt-2 flex items-center justify-between border-t border-dashed border-stone-200 pt-4">
                      <span className="text-sm font-semibold text-stone-500">{t.total}</span>
                      <span className="font-display text-2xl font-semibold">
                        {inr(total)}
                      </span>
                    </div>
                    {restaurant.paymentTiming === "pre" ? (
                      <a
                        href={`upi://pay?pa=${encodeURIComponent(restaurant.upiVpa)}&pn=${encodeURIComponent(restaurant.name)}&am=${total}&cu=INR&tn=${encodeURIComponent(`Narada ${tableCode}`)}`}
                        onClick={placeOrder}
                        className="mt-2 rounded-2xl bg-emerald-700 px-6 py-4 text-center text-sm font-bold text-white shadow-lg shadow-emerald-700/30 transition active:scale-[0.98]"
                      >
                        {t.payToOrder} · {inr(total)}
                      </a>
                    ) : (
                      <button
                        onClick={placeOrder}
                        className="mt-2 rounded-2xl bg-emerald-700 px-6 py-4 text-sm font-bold text-white shadow-lg shadow-emerald-700/30 transition active:scale-[0.98]"
                      >
                        {t.placeOrder} · {inr(total)}
                      </button>
                    )}
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      )}

      {/* Anna chat sheet */}
      {chatOpen && (
        <div className="fixed inset-0 z-50 flex flex-col justify-end">
          <div
            className="animate-fade-in absolute inset-0 bg-emerald-950/50"
            onClick={() => setChatOpen(false)}
          />
          <div className="animate-sheet-up relative flex h-[80dvh] flex-col rounded-t-[2rem] bg-white">
            <div className="flex items-center gap-3 rounded-t-[2rem] bg-emerald-950 px-5 py-4 text-amber-50">
              <span className="grid h-10 w-10 place-items-center rounded-full bg-gradient-to-br from-amber-400 to-yellow-500 text-xl">
                🎙️
              </span>
              <div className="flex-1">
                <p className="text-sm font-bold">Anna</p>
                <p className="text-[11px] text-amber-100/60">{t.annaRole}</p>
              </div>
              <button
                onClick={() => setChatOpen(false)}
                aria-label="close chat"
                className="grid h-8 w-8 place-items-center rounded-full bg-white/10 text-sm"
              >
                ✕
              </button>
            </div>

            <div className="flex-1 overflow-y-auto px-4 py-4">
              {messages.length === 0 && (
                <div className="flex flex-col items-center gap-4 py-8 text-center">
                  <p className="text-4xl">🙏</p>
                  <p className="max-w-60 text-sm text-stone-500">{t.annaGreeting}</p>
                  <div className="flex flex-wrap justify-center gap-2">
                    {t.suggestions.map((s) => (
                      <button
                        key={s}
                        onClick={() => sendToAnna(s)}
                        className="rounded-full bg-emerald-50 px-3 py-2 text-xs font-medium text-emerald-800 ring-1 ring-emerald-200 transition active:scale-95"
                      >
                        {s}
                      </button>
                    ))}
                  </div>
                </div>
              )}
              <div className="flex flex-col gap-3">
                {messages.map((m, i) => (
                  <div
                    key={i}
                    className={`max-w-[80%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed ${
                      m.role === "user"
                        ? "self-end rounded-br-md bg-emerald-950 text-amber-50"
                        : "self-start rounded-bl-md bg-emerald-50 text-stone-800 ring-1 ring-emerald-100"
                    }`}
                  >
                    {m.text}
                  </div>
                ))}
                {thinking && (
                  <div className="flex gap-1.5 self-start rounded-2xl rounded-bl-md bg-emerald-50 px-4 py-3 ring-1 ring-emerald-100">
                    <span className="typing-dot h-1.5 w-1.5 rounded-full bg-emerald-500" />
                    <span className="typing-dot h-1.5 w-1.5 rounded-full bg-emerald-500" />
                    <span className="typing-dot h-1.5 w-1.5 rounded-full bg-emerald-500" />
                  </div>
                )}
                <div ref={chatEndRef} />
              </div>
            </div>

            {itemCount > 0 && (
              <button
                onClick={() => {
                  setChatOpen(false);
                  setCartOpen(true);
                }}
                className="mx-4 mb-2 flex items-center justify-between rounded-xl bg-amber-50 px-4 py-2.5 text-xs font-semibold text-stone-700 ring-1 ring-amber-200"
              >
                <span>
                  🛒 {t.items(itemCount)} · {inr(total)}
                </span>
                <span className="text-emerald-700">{t.reviewOrder}</span>
              </button>
            )}

            <form
              onSubmit={(e) => {
                e.preventDefault();
                sendToAnna(draft);
              }}
              className="flex items-center gap-2 border-t border-stone-100 px-4 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]"
            >
              <input
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                placeholder={t.askAnna}
                className="flex-1 rounded-full bg-stone-100 px-4 py-3 text-sm outline-none placeholder:text-stone-400 focus:ring-2 focus:ring-amber-400"
              />
              <button
                type="submit"
                disabled={thinking || !draft.trim()}
                aria-label="send"
                className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-emerald-700 text-lg text-white shadow transition active:scale-90 disabled:opacity-40"
              >
                ↑
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
