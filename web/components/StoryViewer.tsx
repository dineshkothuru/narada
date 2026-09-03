"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { inr } from "@/lib/format";
import type { Lang } from "@/lib/i18n";
import type { MenuCategory, MenuItem } from "@/lib/types";

// Feast Stories: the menu as full-screen swipeable dish stories.
// Sits under the app's sheets/dock (z-40 < their z-50/60), so cart, voice,
// wheel and order flows all keep working on top of it.
export default function StoryViewer({
  categories,
  items,
  lang,
  strings,
  qtyOf,
  onAdd,
  cartCount,
  cartTotal,
  onOpenCart,
  onOpenVoice,
  onClose,
  showSpin,
  onOpenSpin,
  jumpRef,
}: {
  categories: MenuCategory[];
  items: MenuItem[];
  lang: Lang;
  strings: {
    add: string;
    soldOut: string;
    menuTiles: string;
    storiesHint: string;
    bestseller: string;
    spinBanner: string;
  };
  qtyOf: (id: string) => number;
  onAdd: (item: MenuItem) => void;
  cartCount: number;
  cartTotal: number;
  onOpenCart: () => void;
  onOpenVoice: () => void;
  onClose: () => void;
  showSpin: boolean;
  onOpenSpin: () => void;
  jumpRef: React.MutableRefObject<((itemId: string) => void) | null>;
}) {
  const dishes = useMemo(
    () =>
      categories.flatMap((c) =>
        items.filter((m) => m.categoryId === c.id && m.isAvailable),
      ),
    [categories, items],
  );
  const [index, setIndex] = useState(0);
  const [tilesOpen, setTilesOpen] = useState(false);
  const [tileCat, setTileCat] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const current = dishes[Math.min(index, dishes.length - 1)];
  const currentCat = categories.find((c) => c.id === current?.categoryId);
  const catDishes = dishes.filter((d) => d.categoryId === current?.categoryId);
  const catPos = catDishes.findIndex((d) => d.id === current?.id);

  const jumpTo = (itemId: string) => {
    const i = dishes.findIndex((d) => d.id === itemId);
    if (i < 0) return;
    setTilesOpen(false);
    containerRef.current?.scrollTo({
      top: i * (containerRef.current?.clientHeight ?? 0),
      behavior: "smooth",
    });
  };

  // Narada steers the stories: parent calls this when he mentions dishes
  useEffect(() => {
    jumpRef.current = jumpTo;
    return () => {
      jumpRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dishes]);

  const onScroll = () => {
    const el = containerRef.current;
    if (!el || el.clientHeight === 0) return;
    const i = Math.round(el.scrollTop / el.clientHeight);
    if (i !== index) setIndex(Math.max(0, Math.min(dishes.length - 1, i)));
  };

  if (dishes.length === 0) return null;

  return (
    <div className="fixed inset-0 z-40 mx-auto max-w-md bg-stone-950">
      <div
        ref={containerRef}
        onScroll={onScroll}
        className="no-scrollbar h-full snap-y snap-mandatory overflow-y-auto"
      >
        {dishes.map((item) => {
          const qty = qtyOf(item.id);
          return (
            <section key={item.id} className="relative h-full w-full snap-start">
              {item.imageUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={item.imageUrl}
                  alt={item.name.en}
                  className="absolute inset-0 h-full w-full object-cover"
                  loading="lazy"
                />
              ) : (
                <div className="absolute inset-0 grid place-items-center bg-gradient-to-br from-stone-800 to-stone-950 text-[10rem]">
                  {item.emoji}
                </div>
              )}
              <div className="absolute inset-0 bg-gradient-to-b from-black/60 via-transparent to-black/90" />

              <div className="absolute right-4 bottom-40 flex flex-col items-center gap-4">
                <button
                  onClick={onOpenVoice}
                  className="grid h-12 w-12 place-items-center rounded-full bg-black/45 text-xl backdrop-blur"
                  aria-label="Talk to Narada"
                >
                  🎙️
                </button>
                {showSpin && (
                  <button
                    onClick={onOpenSpin}
                    className="grid h-12 w-12 place-items-center rounded-full bg-black/45 text-xl backdrop-blur"
                    aria-label={strings.spinBanner}
                  >
                    🎡
                  </button>
                )}
              </div>

              <div className="absolute right-0 bottom-0 left-0 p-5 pb-8 text-white">
                <p className="mb-3 max-w-[85%] rounded-r-2xl rounded-bl-2xl border border-white/15 bg-black/50 px-3.5 py-2.5 text-[13px] leading-snug text-stone-100 backdrop-blur">
                  🎙️ {item.description[lang]}
                </p>
                <div className="mb-1 flex items-center gap-2 text-xs font-bold">
                  {item.tags.includes("bestseller") && (
                    <span className="rounded bg-white/90 px-1.5 py-0.5 text-[10px] text-stone-900">
                      {strings.bestseller}
                    </span>
                  )}
                  {item.spiceLevel > 0 && <span>{"🌶️".repeat(item.spiceLevel)}</span>}
                  <span
                    className={`inline-block h-3 w-3 rounded-[3px] border ${item.isVeg ? "border-green-400 bg-green-400/30" : "border-red-400 bg-red-400/30"}`}
                  />
                </div>
                <h1 className="font-display text-4xl leading-[1.05] font-semibold">
                  {item.name[lang]}
                </h1>
                <p className="mt-1 text-lg font-extrabold">{inr(item.priceInr)}</p>
                <div className="mt-4 flex items-center gap-3">
                  <button
                    onClick={() => onAdd(item)}
                    className="flex-1 rounded-2xl bg-rose-600 py-4 text-center text-[15px] font-extrabold shadow-2xl shadow-rose-600/50 transition active:scale-[0.97]"
                  >
                    {qty > 0 ? `✓ ×${qty} · ${strings.add} +` : strings.add}
                  </button>
                </div>
                <p className="mt-3 text-center text-[10.5px] text-white/50">
                  {strings.storiesHint}
                </p>
              </div>
            </section>
          );
        })}
      </div>

      {/* top chrome */}
      <div className="pointer-events-none absolute top-0 right-0 left-0 p-4">
        <div className="mb-3 flex gap-1">
          {catDishes.map((d, i) => (
            <span
              key={d.id}
              className={`h-[3px] flex-1 rounded-full ${i < catPos ? "bg-white" : i === catPos ? "bg-white/90" : "bg-white/30"}`}
            />
          ))}
        </div>
        <div className="pointer-events-auto flex items-center justify-between">
          <button
            onClick={() => {
              setTileCat(null);
              setTilesOpen(true);
            }}
            className="flex items-center gap-2 rounded-full bg-black/45 px-4 py-2 text-xs font-extrabold text-white backdrop-blur"
          >
            ☰ {strings.menuTiles}
            <span className="font-medium text-white/60">
              · {currentCat?.name[lang]}
            </span>
          </button>
          <div className="flex items-center gap-2">
            <button
              onClick={onOpenCart}
              className="rounded-full bg-rose-600 px-4 py-2 text-xs font-extrabold text-white shadow-lg"
            >
              🛒 {cartCount > 0 ? `${cartCount} · ${inr(cartTotal)}` : "0"}
            </button>
            <button
              onClick={onClose}
              aria-label="switch to list view"
              className="grid h-8 w-8 place-items-center rounded-full bg-black/45 text-sm text-white backdrop-blur"
            >
              ≡
            </button>
          </div>
        </div>
      </div>

      {/* section tiles → dish tiles → jump */}
      {tilesOpen && (
        <div className="absolute inset-0 z-10 overflow-y-auto bg-stone-950/97 p-5 backdrop-blur">
          <div className="mb-5 flex items-center justify-between">
            <h2 className="font-display text-2xl font-semibold text-white">
              {tileCat
                ? categories.find((c) => c.id === tileCat)?.name[lang]
                : strings.menuTiles}
            </h2>
            <button
              onClick={() => (tileCat ? setTileCat(null) : setTilesOpen(false))}
              className="grid h-9 w-9 place-items-center rounded-full bg-white/10 text-white"
            >
              {tileCat ? "←" : "✕"}
            </button>
          </div>
          {!tileCat ? (
            <div className="grid grid-cols-2 gap-3">
              {categories.map((c) => {
                const catItems = dishes.filter((d) => d.categoryId === c.id);
                if (catItems.length === 0) return null;
                const cover = catItems.find((d) => d.imageUrl)?.imageUrl;
                return (
                  <button
                    key={c.id}
                    onClick={() => setTileCat(c.id)}
                    className="relative h-32 overflow-hidden rounded-2xl text-left shadow-lg transition active:scale-[0.97]"
                  >
                    {cover ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={cover} alt="" className="absolute inset-0 h-full w-full object-cover" />
                    ) : (
                      <div className="absolute inset-0 grid place-items-center bg-stone-800 text-5xl">
                        {c.emoji}
                      </div>
                    )}
                    <span className="absolute inset-0 bg-gradient-to-t from-black/85 to-black/10" />
                    <span className="absolute bottom-2.5 left-3 right-3">
                      <span className="block text-sm font-extrabold text-white">
                        {c.emoji} {c.name[lang]}
                      </span>
                      <span className="text-[11px] font-semibold text-white/60">
                        {catItems.length} dishes
                      </span>
                    </span>
                  </button>
                );
              })}
            </div>
          ) : (
            <div className="grid grid-cols-3 gap-2.5">
              {dishes
                .filter((d) => d.categoryId === tileCat)
                .map((d) => (
                  <button
                    key={d.id}
                    onClick={() => jumpTo(d.id)}
                    className="overflow-hidden rounded-xl bg-white/5 text-left transition active:scale-[0.96]"
                  >
                    {d.imageUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={d.imageUrl} alt="" className="h-20 w-full object-cover" />
                    ) : (
                      <div className="grid h-20 w-full place-items-center bg-stone-800 text-3xl">
                        {d.emoji}
                      </div>
                    )}
                    <span className="block px-2 py-1.5">
                      <span className="block truncate text-[11px] font-bold text-white">
                        {d.name[lang]}
                      </span>
                      <span className="text-[10.5px] font-semibold text-white/60">
                        {inr(d.priceInr)}
                      </span>
                    </span>
                  </button>
                ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
