import { inr, type CartLine, type Lang, type MenuItem, type STRINGS } from "@narada/shared";
import type { BillSheet, OrderRound } from "@/api/hooks";
import { applyDiscount } from "@/lib/cartMath";
import { ItemPhoto } from "./MenuAtoms";
import { MemoryGame } from "./Games";
import { RoundList, statusDotFor } from "./OrderStatus";

type Strings = (typeof STRINGS)["en"];

export type PlacedState = {
  total: number;
  orderId: string | null;
  orderNo?: string | null;
  sessionId?: string | null;
};

// The bottom sheet the guest checks out in. Before the order is placed it is
// the cart; afterwards it becomes the live order + bill + pay view, which is
// why both faces live in one sheet exactly as the legacy component had them.
export default function Cart({
  cart,
  menuById,
  lang,
  t,
  total,
  discountPct,
  paymentTiming,
  guestName,
  placing,
  orderPlaced,
  rounds,
  myOrderIds,
  orderStatus,
  statusLabel,
  bill,
  payable,
  upiHref,
  preOrderUpiHref,
  compItem,
  gameOpen,
  onOpenGame,
  onGameComplete,
  onChangeQty,
  onGuestName,
  onPlaceOrder,
  onPatchBill,
  onSetTip,
  onAskBill,
  onClose,
}: {
  cart: CartLine[];
  menuById: Map<string, MenuItem>;
  lang: Lang;
  t: Strings;
  total: number;
  discountPct: number;
  paymentTiming: "pre" | "post";
  guestName: string;
  placing: boolean;
  orderPlaced: PlacedState | null;
  rounds: OrderRound[];
  myOrderIds: string[];
  orderStatus: string;
  statusLabel: string;
  bill: BillSheet | null;
  payable: number;
  upiHref: string;
  preOrderUpiHref: string;
  compItem: string | null;
  gameOpen: boolean;
  onOpenGame: () => void;
  onGameComplete: () => void;
  onChangeQty: (itemId: string, delta: number) => void;
  onGuestName: (name: string) => void;
  onPlaceOrder: () => void;
  onPatchBill: (patch: { serviceWaived?: boolean; tip?: number }) => void;
  onSetTip: (tip: number) => void;
  onAskBill: () => void;
  onClose: () => void;
}) {
  const placedView = orderPlaced && cart.length === 0;

  return (
    <div className="fixed inset-0 z-50 flex flex-col justify-end">
      <div className="animate-fade-in absolute inset-0 bg-stone-950/50" onClick={onClose} />
      <div className="animate-sheet-up relative max-h-[85dvh] overflow-y-auto rounded-t-[2rem] bg-white px-5 pt-3 pb-8">
        <div className="mx-auto mb-4 h-1 w-10 rounded-full bg-stone-200" />
        {placedView ? (
          <div className="flex flex-col items-center py-6 text-center">
            <span className="animate-pop text-6xl">✅</span>
            <h2 className="font-display mt-4 text-2xl font-semibold text-stone-900">
              {t.orderSent}
            </h2>
            {orderPlaced.orderNo && (
              <span className="mt-3 rounded border border-dashed border-stone-300 px-3 py-1.5 text-xs font-extrabold tracking-[0.1em] text-stone-700">
                KOT #{orderPlaced.orderNo}
              </span>
            )}
            <p className="mt-2 max-w-xs text-sm text-stone-500">
              {inr(orderPlaced.total)}. {t.orderSentNote}
            </p>
            {rounds.length > 0 ? (
              <RoundList rounds={rounds} myOrderIds={myOrderIds} t={t} />
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
                onClick={onOpenGame}
                className="mt-5 w-full rounded-2xl bg-stone-900 px-5 py-4 text-left shadow-lg transition active:scale-[0.98]"
              >
                <span className="block text-sm font-bold text-white">{t.playTitle}</span>
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
                  onAllLevelsComplete={onGameComplete}
                />
              </div>
            )}

            {compItem && (
              <div className="animate-pop mt-5 w-full rounded-2xl bg-rose-50 p-4 text-sm font-semibold text-rose-700 ring-1 ring-rose-200">
                {t.quizWinComp.replace("{item}", compItem)}
              </div>
            )}

            {bill && (
              <div className="mt-5 w-full rounded-2xl bg-stone-50 p-4 text-left text-xs ring-1 ring-stone-200">
                <div className="flex justify-between py-0.5 text-stone-600">
                  <span>{t.billSubtotal}</span>
                  <span className="font-semibold">{inr(bill.gross)}</span>
                </div>
                {bill.discount > 0 && (
                  <div className="flex justify-between py-0.5 text-rose-600">
                    <span>🎡 {t.discountApplied.replace("{pct}", String(bill.discountPct))}</span>
                    <span className="font-semibold">− {inr(bill.discount)}</span>
                  </div>
                )}
                <div className="flex justify-between py-0.5 text-stone-600">
                  <span>{t.billGst}</span>
                  <span className="font-semibold">{inr(bill.gst)}</span>
                </div>
                <div className="flex items-center justify-between py-0.5 text-stone-600">
                  <span>
                    {t.billService}
                    {!bill.serviceWaived && bill.serviceChargePct > 0
                      ? ` (${bill.serviceChargePct}%)`
                      : ""}
                  </span>
                  <span className="font-semibold">
                    {bill.serviceWaived ? "—" : inr(bill.service)}
                  </span>
                </div>
                {bill.tip > 0 && (
                  <div className="flex justify-between py-0.5 text-green-600">
                    <span>{t.billTip}</span>
                    <span className="font-semibold">{inr(bill.tip)}</span>
                  </div>
                )}
                <div className="mt-2 flex justify-between border-t border-dashed border-stone-300 pt-2 text-sm font-extrabold text-stone-900">
                  <span>{t.billTotal}</span>
                  <span>{inr(bill.net)}</span>
                </div>

                {!bill.serviceWaived && bill.service > 0 && (
                  <button
                    onClick={() => onPatchBill({ serviceWaived: true })}
                    className="mt-2 w-full rounded-lg bg-white py-2 text-[11px] font-bold text-stone-500 ring-1 ring-stone-200"
                  >
                    {t.removeService}
                  </button>
                )}
                {bill.serviceWaived && (
                  <p className="mt-2 text-center text-[10px] font-semibold text-stone-400">
                    ✓ {t.serviceRemoved}
                  </p>
                )}

                <p className="mt-3 text-[10px] font-bold tracking-widest text-stone-400 uppercase">
                  {t.addTip}
                </p>
                <div className="mt-1 flex gap-1.5">
                  {[0, 20, 50, 100].map((amt) => (
                    <button
                      key={amt}
                      onClick={() => {
                        onSetTip(amt);
                        onPatchBill({ tip: amt });
                      }}
                      className={`flex-1 rounded-lg py-2 text-[11px] font-bold transition ${
                        bill.tip === amt
                          ? "bg-stone-900 text-white"
                          : "bg-white text-stone-600 ring-1 ring-stone-200"
                      }`}
                    >
                      {amt === 0 ? "—" : `₹${amt}`}
                    </button>
                  ))}
                </div>

                <a
                  href={`/bill/${orderPlaced.sessionId}`}
                  target="_blank"
                  className="mt-3 block text-center text-[11px] font-bold text-stone-500 underline"
                >
                  {t.viewBill}
                </a>
              </div>
            )}

            <a
              href={upiHref}
              className="mt-4 w-full rounded-2xl bg-rose-600 px-6 py-4 text-sm font-bold text-white shadow-lg shadow-rose-600/25 transition active:scale-[0.98]"
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
              onClick={onAskBill}
              className="mt-3 w-full rounded-2xl bg-stone-900 px-6 py-3 text-xs font-bold text-white transition active:scale-[0.98]"
            >
              🧾 {t.askBill}
            </button>
            <button onClick={onClose} className="mt-2 text-xs font-semibold text-stone-400">
              {t.payLater}
            </button>
          </div>
        ) : (
          <>
            <h2 className="font-display text-2xl font-semibold text-stone-900">{t.yourOrder}</h2>
            <p className="text-xs text-stone-400">{t.payNote}</p>
            {cart.length === 0 ? (
              <p className="py-10 text-center text-sm text-stone-400">{t.emptyCart}</p>
            ) : (
              <div className="mt-4 flex flex-col gap-3">
                {cart.map((line) => {
                  const item = menuById.get(line.itemId);
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
                          <p className="truncate text-[11px] text-rose-600">✎ {line.notes}</p>
                        )}
                        <p className="text-xs text-stone-400">
                          {inr(item.priceInr)} {t.each}
                        </p>
                      </div>
                      <div className="flex items-center gap-2.5 rounded-full bg-white px-2 py-1 ring-1 ring-stone-200">
                        <button
                          onClick={() => onChangeQty(line.itemId, -1)}
                          aria-label="decrease"
                          className="grid h-6 w-6 place-items-center text-lg leading-none text-stone-600 active:scale-90"
                        >
                          −
                        </button>
                        <span className="min-w-4 text-center text-xs font-bold">{line.qty}</span>
                        <button
                          onClick={() => onChangeQty(line.itemId, 1)}
                          aria-label="increase"
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
                  onChange={(e) => onGuestName(e.target.value)}
                  placeholder={t.yourName}
                  maxLength={40}
                  className="rounded-xl bg-stone-100 px-4 py-2.5 text-sm outline-none placeholder:text-stone-400 focus:ring-2 focus:ring-rose-400"
                />
                {paymentTiming === "pre" ? (
                  <a
                    href={preOrderUpiHref}
                    onClick={onPlaceOrder}
                    className="mt-2 rounded-2xl bg-rose-600 px-6 py-4 text-center text-sm font-bold text-white shadow-lg shadow-rose-600/25 transition active:scale-[0.98]"
                  >
                    {t.payToOrder} · {inr(applyDiscount(total, discountPct))}
                  </a>
                ) : (
                  <button
                    onClick={onPlaceOrder}
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
  );
}
