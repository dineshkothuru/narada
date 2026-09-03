"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { LANGS, LANG_NAME, STRINGS, type Lang } from "@/lib/i18n";
import { WHEEL } from "@/lib/games";
import HeroCarousel from "./HeroCarousel";
import MemoryGame from "./MemoryGame";
import SpinWheel from "./SpinWheel";
import VoiceMode, { type VoiceTurnResult } from "./VoiceMode";
import type {
  AnnaResponse,
  CartLine,
  ChatMessage,
  MenuItem,
  MenuPayload,
} from "@/lib/types";

import { inr } from "@/lib/format";

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

function ItemPhoto({
  imageUrl,
  emoji,
  alt,
  className,
}: {
  imageUrl: string | null;
  emoji: string;
  alt: string;
  className: string;
}) {
  const [broken, setBroken] = useState(false);
  if (imageUrl && !broken) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={imageUrl}
        alt={alt}
        loading="lazy"
        onError={() => setBroken(true)}
        className={`${className} object-cover`}
      />
    );
  }
  return (
    <div className={`${className} grid place-items-center bg-stone-100 text-4xl`}>
      {emoji}
    </div>
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
  const [chatChips, setChatChips] = useState<string[]>([]);
  const [thinking, setThinking] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [orderPlaced, setOrderPlaced] = useState<{
    total: number;
    orderId: string | null;
    sessionId?: string | null;
  } | null>(null);
  const [orderStatus, setOrderStatus] = useState<string>("placed");
  const [rounds, setRounds] = useState<
    {
      id: string;
      status: string;
      total_inr: number;
      placed_by?: string | null;
      items: { name: string; qty: number; status?: string }[];
    }[]
  >([]);
  const [guestName, setGuestName] = useState("");
  const [myOrderIds, setMyOrderIds] = useState<string[]>([]);
  const [detailItem, setDetailItem] = useState<MenuItem | null>(null);
  const [placing, setPlacing] = useState(false);
  const [wheelOpen, setWheelOpen] = useState(false);
  const [spinDone, setSpinDone] = useState(false);
  const [spinResult, setSpinResult] = useState<number | null>(null);
  const [gameOpen, setGameOpen] = useState(false);
  const [discountPct, setDiscountPct] = useState(0);
  const [compItem, setCompItem] = useState<string | null>(null);
  const [voiceOpen, setVoiceOpen] = useState(false);
  const [highlightIds, setHighlightIds] = useState<string[]>([]);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const sectionRefs = useRef<Record<string, HTMLElement | null>>({});
  const itemRefs = useRef<Record<string, HTMLElement | null>>({});
  const highlightTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const storageKey = `narada:${tableCode}`;

  // stable refs so async voice turns and deferred confirms never see stale state
  const cartRef = useRef<CartLine[]>(cart);
  const messagesRef = useRef<ChatMessage[]>(messages);
  const langRef = useRef<Lang>(lang);
  const roundsRef = useRef<typeof rounds>([]);
  const myOrderIdsRef = useRef<string[]>([]);
  const placeOrderRef = useRef<(via?: "ui" | "anna") => void>(() => {});
  useEffect(() => {
    cartRef.current = cart;
  }, [cart]);
  useEffect(() => {
    messagesRef.current = messages;
  }, [messages]);
  useEffect(() => {
    langRef.current = lang;
  }, [lang]);
  useEffect(() => {
    roundsRef.current = rounds;
  }, [rounds]);
  useEffect(() => {
    myOrderIdsRef.current = myOrderIds;
  }, [myOrderIds]);

  const MENU_BY_ID = useMemo(
    () => new Map(menuItems.map((m) => [m.id, m])),
    [menuItems],
  );

  useEffect(() => {
    const t = setTimeout(() => {
      try {
        const saved = localStorage.getItem(storageKey);
        if (saved) {
          const s = JSON.parse(saved);
          if (Array.isArray(s.cart)) setCart(s.cart);
          if (Array.isArray(s.messages)) setMessages(s.messages);
          if (s.lang === "en" || s.lang === "hi" || s.lang === "te") setLang(s.lang);
          if (s.spinDone) setSpinDone(true);
          if (typeof s.discountPct === "number") setDiscountPct(s.discountPct);
          if (s.orderPlaced) setOrderPlaced(s.orderPlaced);
          if (typeof s.guestName === "string") setGuestName(s.guestName);
          if (Array.isArray(s.myOrderIds)) setMyOrderIds(s.myOrderIds);
        }
      } catch {}
      setHydrated(true);
    }, 0);
    return () => clearTimeout(t);
  }, [storageKey]);

  // a fresh phone at an already-active table joins the group's live order view
  useEffect(() => {
    if (!hydrated || orderPlaced) return;
    (async () => {
      try {
        const res = await fetch(`/api/session?table=${encodeURIComponent(tableCode)}`);
        if (!res.ok) return;
        const d = await res.json();
        if (d.sessionId) {
          setOrderPlaced({ total: 0, orderId: null, sessionId: d.sessionId });
        }
      } catch {}
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hydrated]);

  useEffect(() => {
    if (!hydrated) return;
    try {
      localStorage.setItem(
        storageKey,
        JSON.stringify({
          cart,
          messages,
          lang,
          spinDone,
          discountPct,
          orderPlaced,
          guestName,
          myOrderIds,
        }),
      );
    } catch {}
  }, [hydrated, cart, messages, lang, spinDone, discountPct, orderPlaced, guestName, myOrderIds, storageKey]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, thinking, chatOpen]);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 2200);
    return () => clearTimeout(t);
  }, [toast]);

  // live kitchen progress: poll the whole table session (every round)
  useEffect(() => {
    const sessionId = orderPlaced?.sessionId;
    const orderId = orderPlaced?.orderId;
    if (!sessionId && !orderId) return;
    const tick = async () => {
      if (document.hidden) return; // no point polling a locked phone
      try {
        const res = await fetch(
          sessionId ? `/api/order?session=${sessionId}` : `/api/order?id=${orderId}`,
        );
        if (!res.ok) return;
        const d = await res.json();
        if (sessionId) {
          if (d.sessionStatus && d.sessionStatus !== "active") {
            // table was settled — reset so the next guest starts clean
            setOrderPlaced(null);
            setRounds([]);
            setDiscountPct(0);
            setMyOrderIds([]);
            setSpinDone(false);
            setSpinResult(null);
            setCompItem(null);
            return;
          }
          if (Array.isArray(d.rounds)) {
            setRounds(d.rounds);
            const latest = d.rounds[d.rounds.length - 1];
            if (latest) setOrderStatus(latest.status);
          }
          if (typeof d.discountPct === "number") setDiscountPct(d.discountPct);
        } else if (d.status) {
          setOrderStatus(d.status);
        }
      } catch {}
    };
    const t = setTimeout(tick, 0);
    const iv = setInterval(tick, 8000);
    const onVisible = () => {
      if (!document.hidden) tick();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      clearTimeout(t);
      clearInterval(iv);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [orderPlaced?.sessionId, orderPlaced?.orderId]);


  const total = useMemo(
    () =>
      cart.reduce((sum, l) => sum + (MENU_BY_ID.get(l.itemId)?.priceInr ?? 0) * l.qty, 0),
    [cart, MENU_BY_ID],
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
    // fold cart actions synchronously so a confirm in the SAME response
    // places exactly the cart Narada just built — no timing games
    let nextCart = [...cartRef.current];
    const curLang = langRef.current;
    for (const a of res.actions) {
      if (a.type === "confirm_order") continue;
      if (a.type === "set_name") {
        // dedupe against names already on the table's rounds: Ravi → Ravi 2
        const base = a.name.trim().slice(0, 30);
        if (base) {
          const taken = new Set(
            roundsRef.current
              .filter((r) => !myOrderIdsRef.current.includes(r.id))
              .map((r) => r.placed_by?.toLowerCase())
              .filter(Boolean),
          );
          let candidate = base;
          for (let n = 2; taken.has(candidate.toLowerCase()); n++) {
            candidate = `${base} ${n}`;
          }
          setGuestName(candidate);
          setToast(`👋 ${candidate}`);
        }
        continue;
      }
      const item = MENU_BY_ID.get(a.itemId);
      if (!item) continue;
      if (a.type === "add") {
        const qty = Math.max(1, a.qty || 1);
        const line = nextCart.find((l) => l.itemId === a.itemId);
        nextCart = line
          ? nextCart.map((l) =>
              l.itemId === a.itemId
                ? { ...l, qty: l.qty + qty, notes: a.notes ?? l.notes }
                : l,
            )
          : [...nextCart, { itemId: a.itemId, qty, notes: a.notes }];
        setToast(`+ ${item.name[curLang]} ×${qty}`);
      } else if (a.type === "remove") {
        nextCart = nextCart.filter((l) => l.itemId !== a.itemId);
        setToast(`− ${item.name[curLang]}`);
      } else if (a.type === "set_qty") {
        nextCart =
          a.qty <= 0
            ? nextCart.filter((l) => l.itemId !== a.itemId)
            : nextCart.some((l) => l.itemId === a.itemId)
              ? nextCart.map((l) => (l.itemId === a.itemId ? { ...l, qty: a.qty } : l))
              : [...nextCart, { itemId: a.itemId, qty: a.qty }];
      }
    }
    cartRef.current = nextCart;
    setCart(nextCart);
    const confirmed = res.actions.some((a) => a.type === "confirm_order");
    if (confirmed) {
      if (nextCart.length > 0) {
        placeOrderRef.current("anna");
        setCartOpen(true);
      }
    } else if (res.suggestCheckout) {
      setCartOpen(true);
    }
    return confirmed;
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
          language: LANG_NAME[langRef.current],
          tableCode,
        }),
      });
      if (!res.ok) throw new Error(String(res.status));
      const data: AnnaResponse = await res.json();
      setMessages((m) => [...m, { role: "assistant", text: data.reply }]);
      applyAnnaActions(data);
      highlightMentioned(data.showItems);
      setChatChips(data.quickReplies ?? []);
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

  const voiceTurn = async (
    body: Record<string, unknown>,
  ): Promise<VoiceTurnResult> => {
    try {
      const res = await fetch("/api/voice", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...body,
          cart: cartRef.current,
          messages: messagesRef.current,
          language: LANG_NAME[langRef.current],
          tableCode,
        }),
      });
      if (!res.ok) return null;
      const data = (await res.json()) as AnnaResponse & {
        transcript: string;
        audio: string | null;
        showItems: string[];
        quickReplies: string[];
      };
      setMessages((m) => [
        ...m,
        ...(data.transcript
          ? [{ role: "user" as const, text: data.transcript }]
          : []),
        { role: "assistant" as const, text: data.reply },
      ]);
      const confirmed = applyAnnaActions(data);
      highlightMentioned(data.showItems);
      return {
        transcript: data.transcript,
        reply: data.reply,
        audio: data.audio,
        endConversation: confirmed,
        quickReplies: data.quickReplies ?? [],
      };
    } catch {
      return null;
    }
  };

  // Narada mentioned dishes: scroll the real menu there and highlight them
  const highlightMentioned = (ids?: string[]) => {
    if (!ids?.length) return;
    setHighlightIds(ids);
    itemRefs.current[ids[0]]?.scrollIntoView({ behavior: "smooth", block: "center" });
    if (highlightTimer.current) clearTimeout(highlightTimer.current);
    highlightTimer.current = setTimeout(() => setHighlightIds([]), 12000);
  };

  const placeOrder = async (via: "ui" | "anna" = "ui") => {
    const lines = cartRef.current;
    if (placing || lines.length === 0) return;
    setPlacing(true);
    const snapshotTotal = lines.reduce(
      (s, l) => s + (MENU_BY_ID.get(l.itemId)?.priceInr ?? 0) * l.qty,
      0,
    );
    try {
      const res = await fetch("/api/order", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tableCode, cart: lines, placedVia: via, guestName }),
      });
      const data = res.ok ? await res.json() : {};
      setOrderPlaced({
        total: data.total ?? snapshotTotal,
        orderId: data.orderId ?? null,
        sessionId: data.sessionId ?? null,
      });
      if (data.orderId) setMyOrderIds((prev) => [...prev, data.orderId]);
      if (typeof data.discountPct === "number") setDiscountPct(data.discountPct);
    } catch {
      setOrderPlaced({ total: snapshotTotal, orderId: null });
    } finally {
      setOrderStatus("placed");
      setCart([]);
      setCompItem(null);
      setGameOpen(false);
      setPlacing(false);
    }
  };
  useEffect(() => {
    placeOrderRef.current = placeOrder;
  });

  const callWaiter = async () => {
    setToast(t.waiterComing);
    try {
      await fetch("/api/waiter-call", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tableCode }),
      });
    } catch {}
  };

  // the SERVER draws the prize (client only animates it) — unforgeable
  const resolveSpin = async (): Promise<number> => {
    const res = await fetch("/api/reward", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tableCode, type: "spin" }),
    });
    if (!res.ok) throw new Error(String(res.status));
    const d = await res.json();
    if (typeof d.discountPct === "number") setDiscountPct(d.discountPct);
    return typeof d.sliceIndex === "number" ? d.sliceIndex : 0;
  };

  const onWheelResult = (idx: number) => {
    setSpinResult(idx);
    setSpinDone(true);
  };

  const payable = orderPlaced
    ? Math.round(
        (rounds.length
          ? rounds.reduce((s, r) => s + Number(r.total_inr), 0)
          : orderPlaced.total) *
          (1 - discountPct / 100),
      )
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
  const statusLabelFor = (status: string) =>
    status === "served"
      ? t.statusServed
      : status === "preparing"
        ? t.statusPreparing
        : status === "queued"
          ? t.inQueue
          : t.statusPlaced;
  const statusDotFor = (status: string) =>
    status === "served"
      ? "bg-green-400"
      : status === "preparing"
        ? "bg-sky-400"
        : status === "queued"
          ? "bg-stone-400"
          : "bg-rose-400";
  const allServed = rounds.length > 0 && rounds.every((r) => r.status === "served");
  // per-dish chips for the scrolling strip under the banner
  const dishChips = useMemo(() => {
    const all = rounds.flatMap((r) =>
      r.items.map((it) => ({
        text: `${it.qty}× ${it.name}`,
        status: it.status ?? r.status,
      })),
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rounds, lang]);
  const statusEmojiFor = (status: string) =>
    status === "served" ? "✅" : status === "preparing" ? "👨‍🍳" : "⏳";
  const heroDishes = useMemo<MenuItem[]>(() => {
    const avail = menuItems.filter((m) => m.isAvailable);
    const specials = avail.filter((m) => m.tags.includes("chef-special"));
    const best = avail.filter(
      (m) => m.tags.includes("bestseller") && !specials.includes(m),
    );
    return [...specials.slice(0, 2), ...best.slice(0, 2)];
  }, [menuItems]);
  const statusLabel = statusLabelFor(orderStatus);

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-md flex-col pb-36">
      {/* Dark hero zone */}
      <div className="rounded-b-[2rem] bg-gradient-to-b from-stone-950 to-stone-900 shadow-xl shadow-stone-950/25">
      <header className="px-5 pt-8 pb-4">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-[11px] font-semibold tracking-[0.18em] text-rose-400 uppercase">
              {tableLabel} · {t.dineIn}
            </p>
            <h1 className="font-display mt-1 text-3xl font-semibold tracking-tight text-white">
              {restaurant.name}
            </h1>
            <p className="mt-0.5 text-xs text-stone-400">{restaurant.tagline}</p>
          </div>
          <div className="flex flex-col items-end gap-2">
            <div className="flex rounded-full bg-white/10 p-0.5">
              {LANGS.map((l) => (
                <button
                  key={l.code}
                  onClick={() => setLang(l.code)}
                  className={`rounded-full px-2.5 py-1 text-[11px] font-bold transition ${
                    lang === l.code ? "bg-white text-stone-900" : "text-stone-400"
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
                  ? "border-green-400 bg-green-500/15 text-green-300"
                  : "border-white/20 text-stone-300"
              }`}
            >
              <VegMark isVeg /> {t.veg}
            </button>
            <button
              onClick={callWaiter}
              className="flex items-center gap-1.5 rounded-full border border-white/20 px-3 py-1.5 text-xs font-semibold text-stone-300 transition active:scale-95"
            >
              🔔 {t.callWaiter}
            </button>
          </div>
        </div>
      </header>

      {/* Hero carousel: specials, offers, Narada */}
      <div className="pt-1 pb-6">
        <HeroCarousel>
          {[
            ...heroDishes.map((item) => (
              <button
                key={item.id}
                onClick={() => {
                  changeQty(item.id, 1);
                  setToast(`+ ${item.name[lang]}`);
                }}
                className="relative block h-44 w-full overflow-hidden rounded-3xl text-left shadow-md transition active:scale-[0.98]"
              >
                <ItemPhoto
                  imageUrl={item.imageUrl}
                  emoji={item.emoji}
                  alt={item.name.en}
                  className="absolute inset-0 h-full w-full"
                />
                <span className="absolute inset-0 bg-gradient-to-t from-stone-950/85 via-stone-950/25 to-transparent" />
                <span className="absolute top-3 left-3 rounded-full bg-white/95 px-2.5 py-1 text-[10px] font-extrabold text-stone-900">
                  {item.tags.includes("chef-special") ? t.heroSpecial : t.bestseller}
                </span>
                <span className="absolute bottom-3 left-4 right-20">
                  <span className="font-display block truncate text-xl font-semibold text-white">
                    {item.name[lang]}
                  </span>
                  <span className="text-sm font-semibold text-stone-200">
                    {inr(item.priceInr)}
                  </span>
                </span>
                <span className="absolute right-3 bottom-4 rounded-lg bg-rose-600 px-4 py-1.5 text-xs font-extrabold text-white shadow">
                  {t.add}
                </span>
              </button>
            )),
            ...(!spinDone
              ? [
                  <button
                    key="spin"
                    onClick={() => setWheelOpen(true)}
                    className="flex h-44 w-full items-center gap-4 overflow-hidden rounded-3xl bg-gradient-to-br from-sky-600 to-indigo-700 px-6 text-left shadow-md transition active:scale-[0.98]"
                  >
                    <span className="text-6xl">🎡</span>
                    <span>
                      <span className="font-display block text-xl font-semibold text-white">
                        {t.spinBanner}
                      </span>
                      <span className="mt-1 block text-xs text-sky-100">{t.spinSub}</span>
                    </span>
                  </button>,
                ]
              : []),
            <button
              key="anna"
              onClick={() => setVoiceOpen(true)}
              className="flex h-44 w-full items-center gap-4 overflow-hidden rounded-3xl bg-rose-600 px-6 text-left shadow-md transition active:scale-[0.98]"
            >
              <span className="grid h-16 w-16 shrink-0 place-items-center rounded-full bg-white/15 text-4xl">
                🎙️
              </span>
              <span>
                <span className="font-display block text-xl font-semibold text-white">
                  {t.talkToAnna}
                </span>
                <span className="mt-1 block text-xs text-rose-100">{t.voiceHint}</span>
              </span>
            </button>,
          ]}
        </HeroCarousel>
      </div>
      </div>

      {/* Sticky zone: live order banner + category chips */}
      <div className="sticky top-0 z-20">
        {orderPlaced && (
          <button
            onClick={() => setCartOpen(true)}
            className="block w-full bg-stone-900 px-4 py-2.5 text-left"
          >
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
                {t.payUpi.replace("{amount}", inr(payable))} ›
              </span>
            </span>
            {dishChips.length > 1 && !allServed && (
              // continuously scrolling per-dish progress strip
              <span className="mt-1.5 block overflow-hidden">
                <span className="animate-marquee flex w-max gap-5">
                  {[...dishChips, ...dishChips].map((c, i) => (
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
        )}
        <nav className="no-scrollbar flex gap-2 overflow-x-auto bg-stone-100/95 px-4 py-3 backdrop-blur">
          {categories.map((c) => (
            <button
              key={c.id}
              onClick={() => scrollToCat(c.id)}
              className={`shrink-0 rounded-full px-4 py-2 text-xs font-semibold whitespace-nowrap transition ${
                activeCat === c.id
                  ? "bg-stone-900 text-white shadow"
                  : "bg-white text-stone-600 ring-1 ring-stone-200"
              }`}
            >
              {c.emoji} {c.name[lang]}
            </button>
          ))}
        </nav>
      </div>

      {/* Menu */}
      <main className="flex flex-col gap-7 px-4 pt-4">
        {discountPct > 0 && !orderPlaced && (
          <div className="rounded-xl bg-rose-50 px-4 py-3 text-center text-xs font-bold text-rose-700 ring-1 ring-rose-200">
            🎉 {t.discountApplied.replace("{pct}", String(discountPct))}
          </div>
        )}
        {categories.map((cat) => {
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
              className="scroll-mt-16 rounded-3xl bg-white p-4 shadow-sm ring-1 ring-stone-200/60"
            >
              <h2 className="font-display mb-1 text-xl font-semibold text-stone-900">
                {cat.name[lang]}
              </h2>
              <div className="flex flex-col divide-y divide-stone-100">
                {items.map((item) => {
                  const qty = qtyOf(item.id);
                  const highlighted = highlightIds.includes(item.id);
                  return (
                    <article
                      key={item.id}
                      ref={(el) => {
                        itemRefs.current[item.id] = el;
                      }}
                      className={`flex gap-4 py-4 transition-all duration-500 ${
                        highlighted
                          ? "-mx-2 rounded-2xl bg-rose-50 px-2 ring-2 ring-rose-400"
                          : ""
                      } ${!item.isAvailable ? "opacity-45 grayscale" : ""}`}
                    >
                      <div
                        className="flex min-w-0 flex-1 flex-col"
                        onClick={() => setDetailItem(item)}
                      >
                        <div className="flex items-center gap-1.5">
                          <VegMark isVeg={item.isVeg} />
                          <SpiceDots level={item.spiceLevel} />
                          {!item.isAvailable ? (
                            <span className="rounded bg-stone-200 px-1.5 py-0.5 text-[10px] font-bold text-stone-500">
                              {t.soldOut}
                            </span>
                          ) : (
                            item.tags.includes("bestseller") && (
                              <span className="rounded bg-rose-50 px-1.5 py-0.5 text-[10px] font-bold text-rose-600">
                                {t.bestseller}
                              </span>
                            )
                          )}
                        </div>
                        <h3 className="mt-1 text-[15px] font-bold text-stone-900">
                          {item.name[lang]}
                        </h3>
                        <p className="mt-0.5 text-sm font-semibold text-stone-700">
                          {inr(item.priceInr)}
                        </p>
                        <p className="mt-1 line-clamp-2 text-xs leading-snug text-stone-500">
                          {item.description[lang]}
                        </p>
                      </div>
                      <div className="relative shrink-0">
                        <span onClick={() => setDetailItem(item)}>
                          <ItemPhoto
                            imageUrl={item.imageUrl}
                            emoji={item.emoji}
                            alt={item.name.en}
                            className="h-28 w-28 rounded-2xl"
                          />
                        </span>
                        <div className="absolute inset-x-3 -bottom-2.5">
                          {!item.isAvailable ? null : qty === 0 ? (
                            <button
                              onClick={() => {
                                changeQty(item.id, 1);
                                setToast(`+ ${item.name[lang]}`);
                              }}
                              className="w-full rounded-lg border border-stone-200 bg-white py-1.5 text-xs font-extrabold text-rose-600 shadow-md transition active:scale-95"
                            >
                              {t.add}
                            </button>
                          ) : (
                            <div className="flex w-full items-center justify-between rounded-lg bg-rose-600 px-1 py-0.5 text-white shadow-md">
                              <button
                                onClick={() => changeQty(item.id, -1)}
                                className="grid h-6 w-7 place-items-center text-lg leading-none active:scale-90"
                                aria-label="decrease"
                              >
                                −
                              </button>
                              <span className="text-xs font-bold">{qty}</span>
                              <button
                                onClick={() => changeQty(item.id, 1)}
                                className="grid h-6 w-7 place-items-center text-lg leading-none active:scale-90"
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
        <div className="animate-pop fixed bottom-40 left-1/2 z-40 -translate-x-1/2 rounded-full bg-stone-900 px-4 py-2 text-xs font-semibold text-white shadow-lg">
          {toast}
        </div>
      )}

      {/* Floating cart bar */}
      {itemCount > 0 && !cartOpen && (
        <button
          onClick={() => setCartOpen(true)}
          className={`animate-pop fixed left-1/2 z-30 flex w-[calc(100%-2.5rem)] max-w-md -translate-x-1/2 items-center justify-between rounded-2xl bg-rose-600 px-5 py-4 text-white shadow-xl shadow-rose-600/30 transition active:scale-[0.98] ${
            voiceOpen ? "bottom-44" : "bottom-5"
          }`}
        >
          <span className="text-sm font-semibold">
            {t.items(itemCount)} · {inr(total)}
          </span>
          <span className="flex items-center gap-1 text-sm font-bold">{t.viewCart}</span>
        </button>
      )}

      {/* Narada FAB — opens the voice conversation */}
      {!chatOpen && !voiceOpen && (
        <button
          onClick={() => setVoiceOpen(true)}
          aria-label="Talk to Narada"
          className={`fixed right-5 z-30 grid h-14 w-14 place-items-center rounded-full bg-rose-600 text-2xl shadow-xl shadow-rose-600/40 transition active:scale-90 ${
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
            className="animate-fade-in absolute inset-0 bg-stone-950/60"
            onClick={() => setWheelOpen(false)}
          />
          <div className="animate-sheet-up relative flex flex-col items-center rounded-t-[2rem] bg-white px-5 pt-3 pb-10">
            <div className="mx-auto mb-4 h-1 w-10 rounded-full bg-stone-200" />
            <h2 className="font-display text-2xl font-semibold text-stone-900">
              {t.spinBanner}
            </h2>
            <p className="mb-5 text-xs text-stone-400">{t.spinSub}</p>
            <SpinWheel strings={{ spin: t.spin }} resolveSpin={resolveSpin} onResult={onWheelResult} />
            {spinResult !== null && (
              <>
                <div
                  className={`animate-pop mt-5 w-full rounded-2xl p-4 text-center text-sm font-semibold ${
                    WHEEL[spinResult].reward.type === "discount"
                      ? "bg-rose-50 text-rose-700 ring-1 ring-rose-200"
                      : "bg-stone-50 text-stone-500 ring-1 ring-stone-200"
                  }`}
                >
                  {WHEEL[spinResult].reward.type === "discount"
                    ? t.spinWin.replace(
                        "{pct}",
                        String((WHEEL[spinResult].reward as { pct: number }).pct),
                      )
                    : t.spinNone}
                </div>
                <button
                  onClick={() => setWheelOpen(false)}
                  className="mt-3 rounded-full bg-stone-900 px-8 py-2.5 text-xs font-bold text-white transition active:scale-95"
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
            className="animate-fade-in absolute inset-0 bg-stone-950/50"
            onClick={() => setCartOpen(false)}
          />
          <div className="animate-sheet-up relative max-h-[85dvh] overflow-y-auto rounded-t-[2rem] bg-white px-5 pt-3 pb-8">
            <div className="mx-auto mb-4 h-1 w-10 rounded-full bg-stone-200" />
            {orderPlaced && cart.length === 0 ? (
              <div className="flex flex-col items-center py-6 text-center">
                <span className="animate-pop text-6xl">✅</span>
                <h2 className="font-display mt-4 text-2xl font-semibold text-stone-900">
                  {t.orderSent}
                </h2>
                <p className="mt-2 max-w-xs text-sm text-stone-500">
                  {tableLabel} · {inr(orderPlaced.total)}. {t.orderSentNote}
                </p>
                {rounds.length > 0 ? (
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
                                  className={`h-2 w-2 shrink-0 rounded-full ${statusDotFor(it.status ?? r.status)} ${(it.status ?? r.status) !== "served" ? "animate-pulse" : ""}`}
                                />
                                <span className="truncate">
                                  {it.qty}× {it.name}
                                </span>
                              </span>
                              <span className="ml-2 shrink-0 text-stone-500">
                                {statusLabelFor(it.status ?? r.status)}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  orderPlaced.orderId && (
                    <span className="mt-3 inline-flex items-center gap-2 rounded-full bg-stone-100 px-4 py-1.5 text-xs font-bold text-stone-700">
                      <span className={`h-2 w-2 rounded-full ${statusDotFor(orderStatus)}`} />
                      {statusLabel}
                    </span>
                  )
                )}

                {!compItem && !gameOpen && (
                  <button
                    onClick={() => setGameOpen(true)}
                    className="mt-5 w-full rounded-2xl bg-stone-900 px-5 py-4 text-left shadow-lg transition active:scale-[0.98]"
                  >
                    <span className="block text-sm font-bold text-white">
                      {t.playTitle}
                    </span>
                    <span className="block text-xs text-stone-300">{t.playSub}</span>
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
                      onAllLevelsComplete={() => {
                        setCompItem("Gulab Jamun (2 pcs)");
                        // fire the free dessert to the kitchen as a ₹0 ticket
                        fetch("/api/reward", {
                          method: "POST",
                          headers: { "Content-Type": "application/json" },
                          body: JSON.stringify({ tableCode, type: "comp" }),
                        }).catch(() => {});
                      }}
                    />
                  </div>
                )}

                {compItem && (
                  <div className="animate-pop mt-5 w-full rounded-2xl bg-rose-50 p-4 text-sm font-semibold text-rose-700 ring-1 ring-rose-200">
                    {t.quizWinComp.replace("{item}", compItem)}
                  </div>
                )}

                <a
                  href={upiLink}
                  className="mt-5 w-full rounded-2xl bg-rose-600 px-6 py-4 text-sm font-bold text-white shadow-lg shadow-rose-600/25 transition active:scale-[0.98]"
                >
                  {t.payUpi.replace("{amount}", inr(payable))}
                  {discountPct > 0 && (
                    <span className="mt-0.5 block text-[11px] font-medium text-rose-200">
                      <s>{inr(orderPlaced.total)}</s> ·{" "}
                      {t.discountApplied.replace("{pct}", String(discountPct))}
                    </span>
                  )}
                </a>
                <button
                  onClick={() => setCartOpen(false)}
                  className="mt-3 text-xs font-semibold text-stone-400"
                >
                  {t.payLater}
                </button>
              </div>
            ) : (
              <>
                <h2 className="font-display text-2xl font-semibold text-stone-900">
                  {t.yourOrder}
                </h2>
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
                          <ItemPhoto
                            imageUrl={item.imageUrl}
                            emoji={item.emoji}
                            alt={item.name.en}
                            className="h-12 w-12 rounded-xl text-2xl"
                          />
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-sm font-semibold text-stone-800">
                              {item.name[lang]}
                            </p>
                            {line.notes && (
                              <p className="truncate text-[11px] text-rose-600">
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
                          <span className="w-14 text-right text-sm font-bold text-stone-800">
                            {inr(item.priceInr * line.qty)}
                          </span>
                        </div>
                      );
                    })}
                    <div className="mt-2 flex items-center justify-between border-t border-dashed border-stone-200 pt-4">
                      <span className="text-sm font-semibold text-stone-500">{t.total}</span>
                      <span className="font-display text-2xl font-semibold text-stone-900">
                        {inr(total)}
                      </span>
                    </div>
                    <input
                      value={guestName}
                      onChange={(e) => setGuestName(e.target.value)}
                      placeholder={t.yourName}
                      maxLength={40}
                      className="rounded-xl bg-stone-100 px-4 py-2.5 text-sm outline-none placeholder:text-stone-400 focus:ring-2 focus:ring-rose-400"
                    />
                    {restaurant.paymentTiming === "pre" ? (
                      <a
                        href={`upi://pay?pa=${encodeURIComponent(restaurant.upiVpa)}&pn=${encodeURIComponent(restaurant.name)}&am=${Math.round(total * (1 - discountPct / 100))}&cu=INR&tn=${encodeURIComponent(`Narada ${tableCode}`)}`}
                        onClick={() => placeOrder("ui")}
                        className="mt-2 rounded-2xl bg-rose-600 px-6 py-4 text-center text-sm font-bold text-white shadow-lg shadow-rose-600/25 transition active:scale-[0.98]"
                      >
                        {t.payToOrder} · {inr(Math.round(total * (1 - discountPct / 100)))}
                      </a>
                    ) : (
                      <button
                        onClick={() => placeOrder("ui")}
                        disabled={placing}
                        className="mt-2 rounded-2xl bg-rose-600 px-6 py-4 text-sm font-bold text-white shadow-lg shadow-rose-600/25 transition active:scale-[0.98] disabled:opacity-60"
                      >
                        {placing ? "…" : `${t.placeOrder} · ${inr(total)}`}
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
            className="animate-fade-in absolute inset-0 bg-stone-950/50"
            onClick={() => setChatOpen(false)}
          />
          <div className="animate-sheet-up relative flex h-[80dvh] flex-col rounded-t-[2rem] bg-white">
            <div className="flex items-center gap-3 rounded-t-[2rem] bg-stone-900 px-5 py-4 text-white">
              <span className="grid h-10 w-10 place-items-center rounded-full bg-rose-600 text-xl">
                🎙️
              </span>
              <div className="flex-1">
                <p className="text-sm font-bold">Narada</p>
                <p className="text-[11px] text-stone-400">{t.annaRole}</p>
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
                        className="rounded-full bg-rose-50 px-3 py-2 text-xs font-medium text-rose-700 ring-1 ring-rose-100 transition active:scale-95"
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
                        ? "self-end rounded-br-md bg-stone-900 text-white"
                        : "self-start rounded-bl-md bg-stone-100 text-stone-800"
                    }`}
                  >
                    {m.text}
                  </div>
                ))}
                {thinking && (
                  <div className="flex gap-1.5 self-start rounded-2xl rounded-bl-md bg-stone-100 px-4 py-3">
                    <span className="typing-dot h-1.5 w-1.5 rounded-full bg-stone-400" />
                    <span className="typing-dot h-1.5 w-1.5 rounded-full bg-stone-400" />
                    <span className="typing-dot h-1.5 w-1.5 rounded-full bg-stone-400" />
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
                className="mx-4 mb-2 flex items-center justify-between rounded-xl bg-stone-50 px-4 py-2.5 text-xs font-semibold text-stone-700 ring-1 ring-stone-200"
              >
                <span>
                  🛒 {t.items(itemCount)} · {inr(total)}
                </span>
                <span className="text-rose-600">{t.reviewOrder}</span>
              </button>
            )}

            {chatChips.length > 0 && (
              <div className="no-scrollbar mx-4 mb-1 flex gap-2 overflow-x-auto">
                {chatChips.map((chip) => (
                  <button
                    key={chip}
                    onClick={() => sendToAnna(chip)}
                    disabled={thinking}
                    className="animate-pop shrink-0 rounded-full bg-rose-50 px-3.5 py-1.5 text-xs font-semibold whitespace-nowrap text-rose-700 ring-1 ring-rose-100 transition active:scale-95 disabled:opacity-40"
                  >
                    {chip}
                  </button>
                ))}
              </div>
            )}
            <form
              onSubmit={(e) => {
                e.preventDefault();
                sendToAnna(draft);
              }}
              className="flex items-center gap-2 border-t border-stone-100 px-4 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]"
            >
              <button
                type="button"
                onClick={() => {
                  setChatOpen(false);
                  setVoiceOpen(true);
                }}
                aria-label="speak to Narada"
                className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-stone-100 text-lg text-stone-700 transition active:scale-90"
              >
                🎙️
              </button>
              <input
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                placeholder={t.askAnna}
                className="flex-1 rounded-full bg-stone-100 px-4 py-3 text-sm outline-none placeholder:text-stone-400 focus:ring-2 focus:ring-rose-400"
              />
              <button
                type="submit"
                disabled={thinking || !draft.trim()}
                aria-label="send"
                className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-rose-600 text-lg text-white shadow transition active:scale-90 disabled:opacity-40"
              >
                ↑
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Dish detail sheet */}
      {detailItem && (
        <div className="fixed inset-0 z-50 flex flex-col justify-end">
          <div
            className="animate-fade-in absolute inset-0 bg-stone-950/50"
            onClick={() => setDetailItem(null)}
          />
          <div className="animate-sheet-up relative overflow-hidden rounded-t-[2rem] bg-white">
            <ItemPhoto
              imageUrl={detailItem.imageUrl}
              emoji={detailItem.emoji}
              alt={detailItem.name.en}
              className="h-52 w-full text-7xl"
            />
            <div className="px-5 pt-4 pb-8">
              <div className="flex items-center gap-2">
                <VegMark isVeg={detailItem.isVeg} />
                <SpiceDots level={detailItem.spiceLevel} />
                {!detailItem.isAvailable && (
                  <span className="rounded bg-stone-200 px-1.5 py-0.5 text-[10px] font-bold text-stone-500">
                    {t.soldOut}
                  </span>
                )}
              </div>
              <div className="mt-1 flex items-start justify-between gap-3">
                <h2 className="font-display text-2xl font-semibold text-stone-900">
                  {detailItem.name[lang]}
                </h2>
                <span className="pt-1 text-lg font-bold text-stone-900">
                  {inr(detailItem.priceInr)}
                </span>
              </div>
              <p className="mt-2 text-sm leading-relaxed text-stone-600">
                {detailItem.description[lang]}
              </p>
              {detailItem.allergens.length > 0 && (
                <p className="mt-3 flex flex-wrap items-center gap-1.5 text-xs text-stone-500">
                  <span className="font-bold">{t.contains}:</span>
                  {detailItem.allergens.map((a) => (
                    <span key={a} className="rounded-full bg-stone-100 px-2 py-0.5 font-semibold">
                      {a}
                    </span>
                  ))}
                </p>
              )}
              {detailItem.isAvailable && (
                <button
                  onClick={() => {
                    changeQty(detailItem.id, 1);
                    setToast(`+ ${detailItem.name[lang]}`);
                    setDetailItem(null);
                  }}
                  className="mt-5 w-full rounded-2xl bg-rose-600 px-6 py-4 text-sm font-bold text-white shadow-lg shadow-rose-600/25 transition active:scale-[0.98]"
                >
                  {t.add} · {inr(detailItem.priceInr)}
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Voice conversation overlay */}
      {voiceOpen && (
        <VoiceMode
          onGreet={() => voiceTurn({ greet: true })}
          onTurn={(wav) => voiceTurn({ audio: wav })}
          onTextTurn={(text) => voiceTurn({ text })}
          onClose={() => setVoiceOpen(false)}
          onSwitchToChat={() => {
            setVoiceOpen(false);
            setChatOpen(true);
          }}
          strings={{
            listening: t.listening,
            thinking: t.thinking,
            speaking: t.speaking,
            endVoice: t.endVoice,
            voiceHint: t.voiceHint,
            annaRole: t.annaRole,
          }}
        />
      )}
    </div>
  );
}
