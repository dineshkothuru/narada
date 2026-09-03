import { useEffect, useMemo, useRef, useState } from "react";
import {
  LANG_NAME,
  STRINGS,
  inr,
  type AnnaResponse,
  type CartLine,
  type ChatMessage,
  type Lang,
  type MenuItem,
  type MenuPayload,
} from "@narada/shared";
import {
  useCallWaiter,
  useCustomerBill,
  useGameReward,
  useOrderRounds,
  usePatchBill,
  usePlaceOrder,
  useSession,
  useSpinReward,
  useVoiceTurn,
  type BillSheet,
  type OrderRound,
} from "@/api/hooks";
import {
  addQty,
  cartTotal,
  changeQty as changeQtyPure,
  itemCount as itemCountOf,
  payableFor,
  qtyOf as qtyOfPure,
  removeLine,
  setQty,
  uniqueGuestName,
  upiLink,
} from "@/lib/cartMath";
import Cart, { type PlacedState } from "./Cart";
import Menu, { DishDetail } from "./Menu";
import SpinSheet from "./SpinSheet";
import { OrderBanner, dishChipsFor, statusDotFor, statusLabelFor } from "./OrderStatus";
import StoryViewer from "./StoryViewer";
import VoiceMode, { type VoiceTurnResult } from "./VoiceMode";

const COMP_ITEM_NAME = "Gulab Jamun (2 pcs)";

// Orchestrator for the whole customer experience. It owns the cart, ephemeral
// voice context and placed-order state; Menu, Cart, VoiceMode, the games and
// stories view are all driven from here.
export default function OrderExperience({
  outletSlug,
  tableCode,
  menu,
}: {
  outletSlug: string;
  tableCode?: string;
  menu: MenuPayload;
}) {
  const { outlet, categories, items: menuItems } = menu;
  const serviceType = tableCode ? "dine_in" : "takeaway";
  const [cart, setCart] = useState<CartLine[]>([]);
  const [lang, setLang] = useState<Lang>("en");
  const [hydrated, setHydrated] = useState(false);
  const [activeCat, setActiveCat] = useState(categories[0]?.id ?? "");
  const [cartOpen, setCartOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [toast, setToast] = useState<string | null>(null);
  const [orderPlaced, setOrderPlaced] = useState<PlacedState | null>(null);
  const [orderError, setOrderError] = useState<string | null>(null);
  const [orderStatus, setOrderStatus] = useState<string>("placed");
  const [rounds, setRounds] = useState<OrderRound[]>([]);
  const [guestName, setGuestName] = useState("");
  const [myOrderIds, setMyOrderIds] = useState<string[]>([]);
  const [detailItem, setDetailItem] = useState<MenuItem | null>(null);
  const [bill, setBill] = useState<BillSheet | null>(null);
  const [tip, setTip] = useState(0);
  const [wheelOpen, setWheelOpen] = useState(false);
  const [spinDone, setSpinDone] = useState(false);
  const [spinResult, setSpinResult] = useState<number | null>(null);
  const [gameOpen, setGameOpen] = useState(false);
  const [discountPct, setDiscountPct] = useState(0);
  const [compItem, setCompItem] = useState<string | null>(null);
  const [voiceOpen, setVoiceOpen] = useState(false);
  const [storiesOpen, setStoriesOpen] = useState(menu.uiVariant === "stories");
  const [highlightIds, setHighlightIds] = useState<string[]>([]);

  const storyJumpRef = useRef<((itemId: string) => void) | null>(null);
  const sectionRefs = useRef<Record<string, HTMLElement | null>>({});
  const itemRefs = useRef<Record<string, HTMLElement | null>>({});
  const highlightTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const storageKey = `narada:${outletSlug}:${tableCode ?? "takeaway"}`;
  const voiceTurnMutation = useVoiceTurn();
  const placeOrderMutation = usePlaceOrder();
  const spinReward = useSpinReward();
  const gameReward = useGameReward();
  const callWaiterMutation = useCallWaiter();
  const patchBillMutation = usePatchBill();

  const placing = placeOrderMutation.isPending;

  // stable refs so async voice turns and deferred confirms never see stale state
  const cartRef = useRef<CartLine[]>(cart);
  const messagesRef = useRef<ChatMessage[]>(messages);
  const langRef = useRef<Lang>(lang);
  const roundsRef = useRef<OrderRound[]>([]);
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

  const MENU_BY_ID = useMemo(() => new Map(menuItems.map((m) => [m.id, m])), [menuItems]);

  useEffect(() => {
    const t = setTimeout(() => {
      try {
        const saved = localStorage.getItem(storageKey);
        if (saved) {
          const s = JSON.parse(saved);
          if (Array.isArray(s.cart)) setCart(s.cart);
          if (s.lang === "en" || s.lang === "hi" || s.lang === "te") setLang(s.lang);
          if (s.spinDone) setSpinDone(true);
          if (typeof s.discountPct === "number") setDiscountPct(s.discountPct);
          if (typeof s.guestName === "string") setGuestName(s.guestName);
          if (Array.isArray(s.myOrderIds)) setMyOrderIds(s.myOrderIds);
        }
      } catch {
        // corrupt or unavailable storage: start clean rather than blocking
      }
      setHydrated(true);
    }, 0);
    return () => clearTimeout(t);
  }, [storageKey]);

  // The server mints/resumes the HttpOnly capability. The returned ID is only
  // an in-memory resource key for polling, never persisted or sent as auth.
  const sessionLookup = useSession({ outletSlug, tableCode }, hydrated);
  const activeSessionId = sessionLookup.data?.sessionId ?? orderPlaced?.sessionId ?? null;

  useEffect(() => {
    if (!hydrated) return;
    try {
      localStorage.setItem(
        storageKey,
        JSON.stringify({
          cart,
          lang,
          spinDone,
          discountPct,
          guestName,
          myOrderIds,
        }),
      );
    } catch {
      // a full or blocked quota must not take the ordering flow down
    }
  }, [hydrated, cart, lang, spinDone, discountPct, orderPlaced, guestName, myOrderIds, storageKey]);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 2200);
    return () => clearTimeout(t);
  }, [toast]);

  // live kitchen progress: poll the whole table session (every round)
  const roundsQuery = useOrderRounds(
    activeSessionId,
    orderPlaced?.sessionId ? null : (orderPlaced?.orderId ?? null),
  );
  useEffect(() => {
    const d = roundsQuery.data;
    if (!d) return;
    if (activeSessionId) {
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
        if (!orderPlaced && d.rounds.length > 0) {
          setOrderPlaced({
            total: d.rounds.reduce((sum, round) => sum + Number(round.total_inr), 0),
            orderId: d.rounds[0]?.id ?? null,
            orderNo: latest?.orderNo ?? null,
            sessionId: activeSessionId,
          });
        }
      }
      if (typeof d.discountPct === "number") setDiscountPct(d.discountPct);
    } else if (d.status) {
      setOrderStatus(d.status);
    }
  }, [roundsQuery.data, activeSessionId, orderPlaced]);

  // live bill (GST + service charge + tip) whenever the order sheet is open
  const billQuery = useCustomerBill(activeSessionId, serviceType, tip, cartOpen);
  useEffect(() => {
    if (billQuery.data) setBill(billQuery.data);
  }, [billQuery.data]);

  const patchBill = (patch: { serviceWaived?: boolean; tip?: number }) => {
    const sessionId = activeSessionId;
    if (!sessionId) return;
    patchBillMutation.mutate({ sessionId, ...patch }, { onSuccess: (next) => setBill(next) });
  };

  const total = useMemo(() => cartTotal(cart, MENU_BY_ID), [cart, MENU_BY_ID]);
  const itemCount = useMemo(() => itemCountOf(cart), [cart]);
  const qtyOf = (itemId: string) => qtyOfPure(cart, itemId);
  const t = STRINGS[lang];

  const changeQty = (itemId: string, delta: number) => {
    setCart((prev) => changeQtyPure(prev, itemId, delta));
    if (delta > 0) {
      const item = MENU_BY_ID.get(itemId);
      if (item) setToast(`+ ${item.name[langRef.current]}`);
    }
  };

  const applyAnnaActions = (res: AnnaResponse) => {
    // fold cart actions synchronously so a confirm in the SAME response
    // places exactly the cart Narada just built — no timing games
    let nextCart = [...cartRef.current];
    const curLang = langRef.current;
    for (const a of res.actions) {
      if (a.type === "confirm_order") continue;
      if (a.type === "set_name") {
        const candidate = uniqueGuestName(
          a.name,
          roundsRef.current
            .filter((r) => !myOrderIdsRef.current.includes(r.id))
            .map((r) => r.placed_by),
        );
        if (candidate) {
          setGuestName(candidate);
          setToast(`👋 ${candidate}`);
        }
        continue;
      }
      const item = MENU_BY_ID.get(a.itemId);
      if (!item) continue;
      if (a.type === "add") {
        const qty = Math.max(1, a.qty || 1);
        nextCart = addQty(nextCart, a.itemId, qty, a.notes);
        setToast(`+ ${item.name[curLang]} ×${qty}`);
      } else if (a.type === "remove") {
        nextCart = removeLine(nextCart, a.itemId);
        setToast(`− ${item.name[curLang]}`);
      } else if (a.type === "set_qty") {
        nextCart = setQty(nextCart, a.itemId, a.qty);
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

  const voiceTurn = async (body: {
    audio?: string;
    text?: string;
    greet?: boolean;
  }): Promise<VoiceTurnResult> => {
    try {
      const data = await voiceTurnMutation.mutateAsync({
        ...body,
        cart: cartRef.current,
        messages: messagesRef.current,
        language: LANG_NAME[langRef.current],
        tableCode,
        outletSlug,
        sessionId: activeSessionId ?? undefined,
      });
      // render the UI in the language the customer is actually using
      // (brain-judged: Hinglish → hi, Tenglish → te, even in Latin script)
      const spoken =
        data.uiLanguage === "hi" || data.uiLanguage === "te" || data.uiLanguage === "en"
          ? data.uiLanguage
          : null;
      if (spoken && spoken !== langRef.current) setLang(spoken);
      setMessages((m) => [
        ...m,
        ...(data.transcript ? [{ role: "user" as const, text: data.transcript }] : []),
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
    storyJumpRef.current?.(ids[0]);
    setHighlightIds(ids);
    itemRefs.current[ids[0]]?.scrollIntoView({ behavior: "smooth", block: "center" });
    if (highlightTimer.current) clearTimeout(highlightTimer.current);
    highlightTimer.current = setTimeout(() => setHighlightIds([]), 12000);
  };

  const placeOrder = async (via: "ui" | "anna" = "ui") => {
    const lines = cartRef.current;
    if (placing || lines.length === 0) return;
    const snapshotTotal = cartTotal(lines, MENU_BY_ID);
    setOrderError(null);
    try {
      const data = await placeOrderMutation.mutateAsync({
        outletSlug,
        tableCode,
        serviceType,
        cart: lines,
        placedVia: via,
        guestName,
        lang: langRef.current,
      });
      setOrderPlaced({
        total: data.total ?? snapshotTotal,
        orderId: data.orderId ?? null,
        sessionId: data.sessionId ?? null,
        orderNo: data.orderNo ?? null,
      });
      if (data.orderId) setMyOrderIds((prev) => [...prev, data.orderId!]);
      if (typeof data.discountPct === "number") setDiscountPct(data.discountPct);
      cartRef.current = [];
      setCart([]);
      setCompItem(null);
      setGameOpen(false);
      setOrderStatus("placed");
    } catch {
      setOrderError("Could not place the order. Please try again.");
    }
  };
  useEffect(() => {
    placeOrderRef.current = placeOrder;
  });

  const callWaiter = () => {
    if (!tableCode) return;
    setToast(t.waiterComing);
    callWaiterMutation.mutate(tableCode);
  };

  // the SERVER draws the prize (client only animates it) — unforgeable
  const resolveSpin = async (): Promise<number> => {
    const d = await spinReward.mutateAsync(tableCode ?? "");
    if (typeof d.discountPct === "number") setDiscountPct(d.discountPct);
    return typeof d.sliceIndex === "number" ? d.sliceIndex : 0;
  };

  const payable = payableFor({
    billNet: bill ? bill.net : null,
    orderTotal: orderPlaced ? orderPlaced.total : null,
    rounds,
    discountPct,
  });

  const scrollToCat = (id: string) => {
    setActiveCat(id);
    sectionRefs.current[id]?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const allServed = rounds.length > 0 && rounds.every((r) => r.status === "served");
  const dishChips = useMemo(() => dishChipsFor(rounds, t), [rounds, t]);
  const heroDishes = useMemo<MenuItem[]>(() => {
    const avail = menuItems.filter((m) => m.isAvailable);
    const specials = avail.filter((m) => m.tags.includes("chef-special"));
    const best = avail.filter((m) => m.tags.includes("bestseller") && !specials.includes(m));
    return [...specials.slice(0, 2), ...best.slice(0, 2)];
  }, [menuItems]);
  const statusLabel = statusLabelFor(orderStatus, t);
  const kindOf = (categoryId: string) =>
    categories.find((c) => c.id === categoryId)?.kind ?? "food";

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-md flex-col pb-36">
      {/* Dark hero zone */}
      <div className="rounded-b-[2rem] bg-gradient-to-b from-stone-950 to-stone-900 shadow-xl shadow-stone-950/25">
        <header className="px-5 pt-8 pb-4">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-[11px] font-semibold tracking-[0.18em] text-rose-400 uppercase">
                {serviceType === "dine_in" ? t.dineIn : "Takeaway"}
              </p>
              <h1 className="font-display mt-1 text-3xl font-semibold tracking-tight text-white">
                {outlet.name}
              </h1>
              <p className="mt-0.5 text-xs text-stone-400">{outlet.tagline}</p>
            </div>
            <div className="flex flex-col items-end gap-2">
              {serviceType === "dine_in" && (
                <button
                  onClick={callWaiter}
                  className="flex items-center gap-1.5 rounded-full border border-white/20 px-3 py-1.5 text-xs font-semibold text-stone-300 transition active:scale-95"
                >
                  🔔 {t.callWaiter}
                </button>
              )}
              {menu.uiVariant === "stories" && (
                <button
                  onClick={() => setStoriesOpen(true)}
                  className="flex items-center gap-1.5 rounded-full border border-rose-400/40 bg-rose-500/15 px-3 py-1.5 text-xs font-bold text-rose-300 transition active:scale-95"
                >
                  ✨ Stories
                </button>
              )}
            </div>
          </div>
        </header>
      </div>

      {/* Sticky zone: live order banner + category chips (inside Menu) */}
      <div className="sticky top-0 z-20">
        {orderPlaced && (
          <OrderBanner
            t={t}
            allServed={allServed}
            statusLabel={statusLabel}
            orderStatus={orderStatus}
            orderNo={orderPlaced.orderNo}
            payableText={t.payUpi.replace("{amount}", inr(payable))}
            chips={dishChips}
            onOpen={() => setCartOpen(true)}
          />
        )}
      </div>

      <Menu
        menu={menu}
        lang={lang}
        t={t}
        activeCat={activeCat}
        heroDishes={heroDishes}
        discountPct={discountPct}
        orderPlaced={Boolean(orderPlaced)}
        spinDone={spinDone}
        showRewards={serviceType === "dine_in"}
        highlightIds={highlightIds}
        qtyOf={qtyOf}
        sectionRefs={sectionRefs}
        itemRefs={itemRefs}
        onScrollToCat={scrollToCat}
        onChangeQty={changeQty}
        onOpenDetail={setDetailItem}
        onOpenSpin={() => setWheelOpen(true)}
        onOpenVoice={() => setVoiceOpen(true)}
      />

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
      {!voiceOpen && (
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

      {wheelOpen && (
        <SpinSheet
          t={t}
          spinResult={spinResult}
          resolveSpin={resolveSpin}
          onResult={(idx) => {
            setSpinResult(idx);
            setSpinDone(true);
          }}
          onClose={() => setWheelOpen(false)}
        />
      )}

      {/* Cart / order sheet */}
      {cartOpen && (
        <Cart
          cart={cart}
          menuById={MENU_BY_ID}
          lang={lang}
          t={t}
          total={total}
          discountPct={discountPct}
          paymentTiming={outlet.paymentTiming}
          guestName={guestName}
          placing={placing}
          orderPlaced={orderPlaced}
          rounds={rounds}
          myOrderIds={myOrderIds}
          orderStatus={orderStatus}
          statusLabel={statusLabel}
          bill={bill}
          payable={payable}
          upiHref={
            orderPlaced
              ? upiLink({
                  vpa: outlet.upiVpa,
                  payeeName: outlet.name,
                  amount: payable,
                  tableCode: tableCode ?? "Takeaway",
                })
              : ""
          }
          preOrderUpiHref={upiLink({
            vpa: outlet.upiVpa,
            payeeName: outlet.name,
            amount: Math.round(total * (1 - discountPct / 100)),
            tableCode: tableCode ?? "Takeaway",
          })}
          compItem={compItem}
          gameOpen={gameOpen}
          canPlayGame={serviceType === "dine_in"}
          sessionReady={serviceType === "dine_in" || Boolean(activeSessionId)}
          orderError={orderError}
          onOpenGame={() => setGameOpen(true)}
          onGameComplete={() => {
            setCompItem(COMP_ITEM_NAME);
            // fire the free dessert to the kitchen as a ₹0 ticket
            gameReward.mutate(tableCode ?? "");
          }}
          onChangeQty={(itemId, delta) => setCart((prev) => changeQtyPure(prev, itemId, delta))}
          onGuestName={setGuestName}
          onPlaceOrder={() => placeOrder("ui")}
          onPatchBill={patchBill}
          onSetTip={setTip}
          onAskBill={() => {
            callWaiter();
            setToast(t.billRequested);
          }}
          onClose={() => setCartOpen(false)}
        />
      )}

      {/* Feast Stories mode (per-table ui_variant) */}
      {storiesOpen && (
        <StoryViewer
          categories={categories}
          items={menuItems}
          lang={lang}
          strings={{
            add: t.add,
            soldOut: t.soldOut,
            menuTiles: t.menuTiles,
            storiesHint: t.storiesHint,
            bestseller: t.bestseller,
            spinBanner: t.spinBanner,
          }}
          qtyOf={qtyOf}
          onAdd={(item) => changeQty(item.id, 1)}
          cartCount={itemCount}
          cartTotal={total}
          onOpenCart={() => setCartOpen(true)}
          onOpenVoice={() => setVoiceOpen(true)}
          onClose={() => setStoriesOpen(false)}
          showSpin={serviceType === "dine_in" && !spinDone && !orderPlaced}
          onOpenSpin={() => setWheelOpen(true)}
          highlightId={highlightIds[0] ?? null}
          orderBanner={
            orderPlaced
              ? {
                  label: allServed ? t.allServed : statusLabel,
                  dotClass: allServed ? "bg-green-400" : statusDotFor(orderStatus),
                  payText: t.payUpi.replace("{amount}", inr(payable)),
                  orderNo: orderPlaced.orderNo,
                }
              : null
          }
          jumpRef={storyJumpRef}
        />
      )}

      {/* Dish detail sheet */}
      {detailItem && (
        <DishDetail
          item={detailItem}
          lang={lang}
          t={t}
          kind={kindOf(detailItem.categoryId)}
          onAdd={() => {
            changeQty(detailItem.id, 1);
            setDetailItem(null);
          }}
          onClose={() => setDetailItem(null)}
        />
      )}

      {/* Voice conversation overlay */}
      {voiceOpen && (
        <VoiceMode
          minimal={storiesOpen}
          onGreet={() => voiceTurn({ greet: true })}
          onTurn={(wav) => voiceTurn({ audio: wav })}
          onTextTurn={(text) => voiceTurn({ text })}
          onClose={() => setVoiceOpen(false)}
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
