"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";

type AdminItem = {
  id: string;
  category_id: string;
  name: string;
  price_inr: number;
  is_veg: boolean;
  is_available: boolean;
  tags: string[];
};
type AdminCategory = { id: string; name: string; emoji: string | null };
type AdminRestaurant = {
  id: string;
  name: string;
  upi_vpa: string | null;
  payment_timing: "pre" | "post";
  admin_pin: string;
  gemini_api_key: string | null;
  sarvam_api_key: string | null;
};

const inr = (n: number) => `₹${Number(n).toLocaleString("en-IN")}`;

export default function AdminPage() {
  const [categories, setCategories] = useState<AdminCategory[]>([]);
  const [items, setItems] = useState<AdminItem[]>([]);
  const [restaurant, setRestaurant] = useState<AdminRestaurant | null>(null);
  const [saved, setSaved] = useState<string | null>(null);

  const load = useCallback(async () => {
    const res = await fetch("/api/admin/menu", { cache: "no-store" });
    if (!res.ok) return;
    const d = await res.json();
    setCategories(d.categories ?? []);
    setItems(d.items ?? []);
    setRestaurant(d.restaurant ?? null);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (!saved) return;
    const t = setTimeout(() => setSaved(null), 1800);
    return () => clearTimeout(t);
  }, [saved]);

  const toggleTag = (item: AdminItem, tag: string) => {
    const tags = item.tags.includes(tag)
      ? item.tags.filter((x) => x !== tag)
      : [...item.tags, tag];
    patchItem(item.id, { tags });
  };

  const patchItem = async (
    itemId: string,
    patch: { is_available?: boolean; price_inr?: number; tags?: string[] },
  ) => {
    setItems((prev) => prev.map((i) => (i.id === itemId ? { ...i, ...patch } : i)));
    await fetch("/api/admin/menu", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ itemId, ...patch }),
    });
    setSaved("Saved");
  };

  const patchSettings = async (patch: Record<string, string>) => {
    if (!restaurant) return;
    await fetch("/api/admin/settings", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ restaurantId: restaurant.id, ...patch }),
    });
    setSaved("Saved");
    load();
  };

  const logout = async () => {
    await fetch("/api/admin/login", { method: "DELETE" });
    window.location.href = "/admin/login";
  };

  return (
    <main className="min-h-dvh bg-stone-100 p-4 sm:p-6">
      <header className="mx-auto mb-5 flex max-w-3xl items-center justify-between">
        <div>
          <h1 className="font-display text-2xl font-semibold text-stone-900">
            {restaurant?.name ?? "Narada"} · Admin
          </h1>
          <p className="text-xs text-stone-500">
            Menu availability, prices &amp; restaurant settings
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Link
            href="/kitchen"
            className="rounded-full bg-stone-900 px-4 py-2 text-xs font-bold text-white"
          >
            Kitchen →
          </Link>
          <button
            onClick={logout}
            className="rounded-full bg-white px-4 py-2 text-xs font-bold text-stone-600 ring-1 ring-stone-200"
          >
            Log out
          </button>
        </div>
      </header>

      {saved && (
        <div className="fixed top-4 left-1/2 z-50 -translate-x-1/2 rounded-full bg-stone-900 px-4 py-2 text-xs font-bold text-white shadow-lg">
          ✓ {saved}
        </div>
      )}

      {restaurant && (
        <section className="mx-auto mb-6 max-w-3xl rounded-3xl bg-white p-5 shadow-sm ring-1 ring-stone-200/60">
          <h2 className="text-xs font-bold tracking-widest text-stone-500 uppercase">
            Settings
          </h2>
          <div className="mt-3 grid gap-4 sm:grid-cols-3">
            <label className="text-xs font-semibold text-stone-600">
              Payment timing
              <select
                value={restaurant.payment_timing}
                onChange={(e) => patchSettings({ payment_timing: e.target.value })}
                className="mt-1 w-full rounded-xl bg-stone-100 px-3 py-2.5 text-sm font-semibold outline-none"
              >
                <option value="post">Order first, pay at the end</option>
                <option value="pre">Pay to place the order</option>
              </select>
            </label>
            <label className="text-xs font-semibold text-stone-600">
              UPI ID (VPA)
              <input
                defaultValue={restaurant.upi_vpa ?? ""}
                onBlur={(e) => {
                  if (e.target.value !== restaurant.upi_vpa) {
                    patchSettings({ upi_vpa: e.target.value });
                  }
                }}
                placeholder="restaurant@upi"
                className="mt-1 w-full rounded-xl bg-stone-100 px-3 py-2.5 text-sm font-semibold outline-none focus:ring-2 focus:ring-rose-400"
              />
            </label>
            <label className="text-xs font-semibold text-stone-600">
              Staff PIN
              <input
                defaultValue={restaurant.admin_pin}
                onBlur={(e) => {
                  if (e.target.value !== restaurant.admin_pin && e.target.value.length >= 4) {
                    patchSettings({ admin_pin: e.target.value });
                  }
                }}
                className="mt-1 w-full rounded-xl bg-stone-100 px-3 py-2.5 text-sm font-semibold outline-none focus:ring-2 focus:ring-rose-400"
              />
            </label>
            <label className="text-xs font-semibold text-stone-600 sm:col-span-2">
              Gemini API key <span className="font-normal text-stone-400">(Narada&apos;s brain)</span>
              <input
                type="password"
                defaultValue={restaurant.gemini_api_key ?? ""}
                onBlur={(e) => {
                  if (e.target.value !== (restaurant.gemini_api_key ?? "")) {
                    patchSettings({ gemini_api_key: e.target.value });
                  }
                }}
                placeholder="AIza…  (falls back to server env if empty)"
                className="mt-1 w-full rounded-xl bg-stone-100 px-3 py-2.5 text-sm font-semibold outline-none focus:ring-2 focus:ring-rose-400"
              />
            </label>
            <label className="text-xs font-semibold text-stone-600">
              Sarvam API key <span className="font-normal text-stone-400">(voice)</span>
              <input
                type="password"
                defaultValue={restaurant.sarvam_api_key ?? ""}
                onBlur={(e) => {
                  if (e.target.value !== (restaurant.sarvam_api_key ?? "")) {
                    patchSettings({ sarvam_api_key: e.target.value });
                  }
                }}
                placeholder="falls back to server env if empty"
                className="mt-1 w-full rounded-xl bg-stone-100 px-3 py-2.5 text-sm font-semibold outline-none focus:ring-2 focus:ring-rose-400"
              />
            </label>
          </div>
        </section>
      )}

      <div className="mx-auto flex max-w-3xl flex-col gap-4">
        {categories.map((cat) => {
          const list = items.filter((i) => i.category_id === cat.id);
          if (list.length === 0) return null;
          return (
            <section
              key={cat.id}
              className="rounded-3xl bg-white p-5 shadow-sm ring-1 ring-stone-200/60"
            >
              <h2 className="text-sm font-bold text-stone-800">
                {cat.emoji} {cat.name}
              </h2>
              <div className="mt-2 divide-y divide-stone-100">
                {list.map((item) => (
                  <div key={item.id} className="flex items-center gap-3 py-2.5">
                    <span
                      className={`min-w-0 flex-1 truncate text-sm font-medium ${
                        item.is_available ? "text-stone-800" : "text-stone-400 line-through"
                      }`}
                    >
                      {item.name}
                    </span>
                    <button
                      onClick={() => toggleTag(item, "chef-special")}
                      title="Chef's Special — shows in the top carousel"
                      className={`text-base transition active:scale-90 ${
                        item.tags.includes("chef-special") ? "" : "opacity-25 grayscale"
                      }`}
                    >
                      ✨
                    </button>
                    <button
                      onClick={() => toggleTag(item, "bestseller")}
                      title="Bestseller — badge + carousel"
                      className={`text-base transition active:scale-90 ${
                        item.tags.includes("bestseller") ? "" : "opacity-25 grayscale"
                      }`}
                    >
                      ⭐
                    </button>
                    <span className="flex items-center gap-1 text-sm font-semibold text-stone-600">
                      ₹
                      <input
                        type="number"
                        defaultValue={item.price_inr}
                        onBlur={(e) => {
                          const v = Number(e.target.value);
                          if (v > 0 && v !== item.price_inr) {
                            patchItem(item.id, { price_inr: v });
                          }
                        }}
                        className="w-16 rounded-lg bg-stone-100 px-2 py-1 text-right text-sm font-semibold outline-none focus:ring-2 focus:ring-rose-400"
                      />
                    </span>
                    <button
                      onClick={() => patchItem(item.id, { is_available: !item.is_available })}
                      aria-label={item.is_available ? "mark sold out" : "mark available"}
                      className={`relative h-6 w-11 rounded-full transition ${
                        item.is_available ? "bg-green-500" : "bg-stone-300"
                      }`}
                    >
                      <span
                        className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all ${
                          item.is_available ? "left-[22px]" : "left-0.5"
                        }`}
                      />
                    </button>
                  </div>
                ))}
              </div>
            </section>
          );
        })}
        <p className="pb-6 text-center text-[11px] text-stone-400">
          Sold-out items disappear from the customer menu (and from what {""}
          Narada offers) within a minute.
        </p>
      </div>
    </main>
  );
}
