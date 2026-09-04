import type { RefObject } from "react";
import { inr, type Lang, type MenuItem, type MenuPayload } from "@narada/shared";
import type { STRINGS } from "@narada/shared";
import HeroCarousel from "./HeroCarousel";
import { ItemPhoto, SpiceDots, VegMark } from "./MenuAtoms";
import { Button } from "@/components/ui/button";

type Strings = (typeof STRINGS)["en"];

// The browsable menu: hero carousel, sticky category chips and the per-category
// dish list. Purely presentational — every mutation goes back up to the
// orchestrator, which owns the cart.
export default function Menu({
  menu,
  lang,
  t,
  activeCat,
  heroDishes,
  discountPct,
  orderPlaced,
  spinDone,
  showRewards,
  highlightIds,
  qtyOf,
  sectionRefs,
  itemRefs,
  onScrollToCat,
  onChangeQty,
  onOpenDetail,
  onOpenSpin,
  onOpenVoice,
}: {
  menu: MenuPayload;
  lang: Lang;
  t: Strings;
  activeCat: string;
  heroDishes: MenuItem[];
  discountPct: number;
  orderPlaced: boolean;
  spinDone: boolean;
  showRewards: boolean;
  highlightIds: string[];
  qtyOf: (itemId: string) => number;
  sectionRefs: RefObject<Record<string, HTMLElement | null>>;
  itemRefs: RefObject<Record<string, HTMLElement | null>>;
  onScrollToCat: (id: string) => void;
  onChangeQty: (itemId: string, delta: number) => void;
  onOpenDetail: (item: MenuItem) => void;
  onOpenSpin: () => void;
  onOpenVoice: () => void;
}) {
  const { categories, items: menuItems } = menu;
  const kindOf = (categoryId: string) =>
    categories.find((c) => c.id === categoryId)?.kind ?? "food";

  return (
    <>
      {/* Hero carousel: specials, offers, Narada */}
      <div className="pt-1 pb-6">
        <HeroCarousel>
          {[
            ...heroDishes.map((item) => (
              <Button
                key={item.id}
                onClick={() => onChangeQty(item.id, 1)}
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
                <span className="absolute right-20 bottom-3 left-4">
                  <span className="font-display block truncate text-xl font-semibold text-white">
                    {item.name[lang]}
                  </span>
                  <span className="text-sm font-semibold text-stone-200">{inr(item.priceInr)}</span>
                </span>
                <span className="absolute right-3 bottom-4 rounded-lg bg-rose-600 px-4 py-1.5 text-xs font-extrabold text-white shadow">
                  {t.add}
                </span>
              </Button>
            )),
            ...(!spinDone && showRewards
              ? [
                  <Button
                    key="spin"
                    onClick={onOpenSpin}
                    className="flex h-44 w-full items-center gap-4 overflow-hidden rounded-3xl bg-gradient-to-br from-sky-600 to-indigo-700 px-6 text-left shadow-md transition active:scale-[0.98]"
                  >
                    <span className="text-6xl">🎡</span>
                    <span>
                      <span className="font-display block text-xl font-semibold text-white">
                        {t.spinBanner}
                      </span>
                      <span className="mt-1 block text-xs text-sky-100">{t.spinSub}</span>
                    </span>
                  </Button>,
                ]
              : []),
            <Button
              key="anna"
              onClick={onOpenVoice}
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
            </Button>,
          ]}
        </HeroCarousel>
      </div>

      <nav className="no-scrollbar flex gap-2 overflow-x-auto bg-stone-100/95 px-4 py-3 backdrop-blur">
        {categories.map((c) => (
          <Button
            key={c.id}
            onClick={() => onScrollToCat(c.id)}
            className={`shrink-0 rounded-full px-4 py-2 text-xs font-semibold whitespace-nowrap transition ${
              activeCat === c.id
                ? "bg-stone-900 text-white shadow"
                : "bg-white text-stone-600 ring-1 ring-stone-200"
            }`}
          >
            {c.emoji} {c.name[lang]}
          </Button>
        ))}
      </nav>

      <main className="flex flex-col gap-7 px-4 pt-4">
        {discountPct > 0 && !orderPlaced && (
          <div className="rounded-xl bg-rose-50 px-4 py-3 text-center text-xs font-bold text-rose-700 ring-1 ring-rose-200">
            🎉 {t.discountApplied.replace("{pct}", String(discountPct))}
          </div>
        )}
        {categories.map((cat) => {
          const items = menuItems.filter((m) => m.categoryId === cat.id);
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
                        highlighted ? "-mx-2 rounded-2xl bg-rose-50 px-2 ring-2 ring-rose-400" : ""
                      } ${!item.isAvailable ? "opacity-45 grayscale" : ""}`}
                    >
                      <div
                        className="flex min-w-0 flex-1 flex-col"
                        onClick={() => onOpenDetail(item)}
                      >
                        <div className="flex items-center gap-1.5">
                          <VegMark isVeg={item.isVeg} />
                          <SpiceDots level={item.spiceLevel} kind={kindOf(item.categoryId)} />
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
                        <span onClick={() => onOpenDetail(item)}>
                          <ItemPhoto
                            imageUrl={item.imageUrl}
                            emoji={item.emoji}
                            alt={item.name.en}
                            className="h-28 w-28 rounded-2xl"
                          />
                        </span>
                        <div className="absolute inset-x-3 -bottom-2.5">
                          {!item.isAvailable ? null : qty === 0 ? (
                            <Button
                              onClick={() => onChangeQty(item.id, 1)}
                              className="w-full rounded-lg border border-stone-200 bg-white py-1.5 text-xs font-extrabold text-rose-600 shadow-md transition active:scale-95"
                            >
                              {t.add}
                            </Button>
                          ) : (
                            <div className="flex w-full items-center justify-between rounded-lg bg-rose-600 px-1 py-0.5 text-white shadow-md">
                              <Button
                                onClick={() => onChangeQty(item.id, -1)}
                                className="grid h-6 w-7 place-items-center text-lg leading-none active:scale-90"
                                aria-label="decrease"
                              >
                                −
                              </Button>
                              <span className="text-xs font-bold">{qty}</span>
                              <Button
                                onClick={() => onChangeQty(item.id, 1)}
                                className="grid h-6 w-7 place-items-center text-lg leading-none active:scale-90"
                                aria-label="increase"
                              >
                                +
                              </Button>
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
    </>
  );
}

// The dish sheet that opens when a guest taps a menu row.
export function DishDetail({
  item,
  lang,
  t,
  kind,
  onAdd,
  onClose,
}: {
  item: MenuItem;
  lang: Lang;
  t: Strings;
  kind: "food" | "drink";
  onAdd: () => void;
  onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex flex-col justify-end">
      <div className="animate-fade-in absolute inset-0 bg-stone-950/50" onClick={onClose} />
      <div className="animate-sheet-up relative overflow-hidden rounded-t-[2rem] bg-white">
        <ItemPhoto
          imageUrl={item.imageUrl}
          emoji={item.emoji}
          alt={item.name.en}
          className="h-52 w-full text-7xl"
        />
        <div className="px-5 pt-4 pb-8">
          <div className="flex items-center gap-2">
            <VegMark isVeg={item.isVeg} />
            <SpiceDots level={item.spiceLevel} kind={kind} />
            {!item.isAvailable && (
              <span className="rounded bg-stone-200 px-1.5 py-0.5 text-[10px] font-bold text-stone-500">
                {t.soldOut}
              </span>
            )}
          </div>
          <div className="mt-1 flex items-start justify-between gap-3">
            <h2 className="font-display text-2xl font-semibold text-stone-900">
              {item.name[lang]}
            </h2>
            <span className="pt-1 text-lg font-bold text-stone-900">{inr(item.priceInr)}</span>
          </div>
          <p className="mt-2 text-sm leading-relaxed text-stone-600">{item.description[lang]}</p>
          {item.allergens.length > 0 && (
            <p className="mt-3 flex flex-wrap items-center gap-1.5 text-xs text-stone-500">
              <span className="font-bold">{t.contains}:</span>
              {item.allergens.map((a) => (
                <span key={a} className="rounded-full bg-stone-100 px-2 py-0.5 font-semibold">
                  {a}
                </span>
              ))}
            </p>
          )}
          {item.isAvailable && (
            <Button
              onClick={onAdd}
              className="mt-5 w-full rounded-2xl bg-rose-600 px-6 py-4 text-sm font-bold text-white shadow-lg shadow-rose-600/25 transition active:scale-[0.98]"
            >
              {t.add} · {inr(item.priceInr)}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
