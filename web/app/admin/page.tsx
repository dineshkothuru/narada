"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

type AdminItem = {
  id: string;
  category_id: string;
  name: string;
  description: string | null;
  price_inr: number;
  is_veg: boolean;
  is_available: boolean;
  tags: string[];
  spice_level: number;
  allergens: string[];
};
type AdminCategory = { id: string; name: string; emoji: string | null };
type StaffRow = {
  id: string;
  name: string;
  role: "admin" | "kitchen" | "waiter";
  pin: string;
  active: boolean;
};
type AdminRestaurant = {
  id: string;
  name: string;
  upi_vpa: string | null;
  payment_timing: "pre" | "post";
  admin_pin: string;
  gemini_api_key: string | null;
  sarvam_api_key: string | null;
  comp_item_id: string | null;
};

export default function AdminPage() {
  const router = useRouter();
  const [categories, setCategories] = useState<AdminCategory[]>([]);
  const [items, setItems] = useState<AdminItem[]>([]);
  const [restaurant, setRestaurant] = useState<AdminRestaurant | null>(null);
  const [saved, setSaved] = useState<string | null>(null);
  const [editing, setEditing] = useState<string | null>(null);
  const [addingTo, setAddingTo] = useState<string | null>(null);
  const [addingSection, setAddingSection] = useState(false);
  const [staff, setStaff] = useState<StaffRow[]>([]);
  const [tables, setTables] = useState<
    { id: string; label: string; code: string; ui_variant: string }[]
  >([]);
  const [addingStaff, setAddingStaff] = useState(false);

  const load = useCallback(async () => {
    const [res, sres, tres] = await Promise.all([
      fetch("/api/admin/menu", { cache: "no-store" }),
      fetch("/api/admin/staff", { cache: "no-store" }),
      fetch("/api/admin/tables", { cache: "no-store" }),
    ]);
    if (res.ok) {
      const d = await res.json();
      setCategories(d.categories ?? []);
      setItems(d.items ?? []);
      setRestaurant(d.restaurant ?? null);
    }
    if (sres.ok) {
      const s = await sres.json();
      setStaff(s.staff ?? []);
    }
    if (tres.ok) {
      const tt = await tres.json();
      setTables(tt.tables ?? []);
    }
  }, []);

  useEffect(() => {
    const t = setTimeout(load, 0);
    return () => clearTimeout(t);
  }, [load]);

  useEffect(() => {
    if (!saved) return;
    const t = setTimeout(() => setSaved(null), 2200);
    return () => clearTimeout(t);
  }, [saved]);

  const flash = (msg: string) => setSaved(msg);

  const patchItem = async (
    itemId: string,
    patch: Partial<Pick<AdminItem, "is_available" | "price_inr" | "tags" | "description" | "spice_level" | "is_veg" | "allergens">>,
  ) => {
    setItems((prev) => prev.map((i) => (i.id === itemId ? { ...i, ...patch } : i)));
    await fetch("/api/admin/menu", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ itemId, ...patch }),
    });
    flash("Saved");
  };

  const toggleTag = (item: AdminItem, tag: string) => {
    const tags = item.tags.includes(tag)
      ? item.tags.filter((x) => x !== tag)
      : [...item.tags, tag];
    patchItem(item.id, { tags });
  };

  const deleteItem = async (item: AdminItem) => {
    if (!confirm(`Remove "${item.name}" from the menu?`)) return;
    const res = await fetch(`/api/admin/menu?itemId=${item.id}`, { method: "DELETE" });
    const d = await res.json();
    flash(d.ok ? "Dish removed" : (d.reason ?? "Failed"));
    load();
  };

  const addItem = async (categoryId: string, form: HTMLFormElement) => {
    const fd = new FormData(form);
    const res = await fetch("/api/admin/menu", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        category_id: categoryId,
        name: fd.get("name"),
        price_inr: Number(fd.get("price")),
        description: fd.get("description"),
        is_veg: fd.get("veg") === "on",
        spice_level: Number(fd.get("spice") ?? 0),
        emoji: fd.get("emoji") || "🍽️",
      }),
    });
    const d = await res.json();
    flash(d.ok ? "Dish added" : (d.error ?? "Failed"));
    setAddingTo(null);
    load();
  };

  const addSection = async (form: HTMLFormElement) => {
    const fd = new FormData(form);
    const res = await fetch("/api/admin/categories", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: fd.get("name"), emoji: fd.get("emoji") }),
    });
    const d = await res.json();
    flash(d.ok ? "Section added" : (d.error ?? "Failed"));
    setAddingSection(false);
    load();
  };

  const deleteSection = async (cat: AdminCategory) => {
    const count = items.filter((i) => i.category_id === cat.id).length;
    if (!confirm(`Remove section "${cat.name}"${count ? ` and its ${count} dishes` : ""}?`))
      return;
    const res = await fetch(`/api/admin/categories?id=${cat.id}`, { method: "DELETE" });
    const d = await res.json();
    flash(d.ok ? "Section removed" : (d.reason ?? "Failed"));
    load();
  };

  const patchSettings = async (patch: Record<string, string>) => {
    if (!restaurant) return;
    await fetch("/api/admin/settings", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ restaurantId: restaurant.id, ...patch }),
    });
    flash("Saved");
    load();
  };

  const logout = async () => {
    await fetch("/api/admin/login", { method: "DELETE" });
    router.replace("/admin/login");
  };

  const inputCls =
    "mt-1 w-full rounded-xl bg-stone-100 px-3 py-2.5 text-sm font-semibold outline-none focus:ring-2 focus:ring-rose-400";

  return (
    <main className="min-h-dvh bg-stone-100 p-4 sm:p-6">
      <header className="mx-auto mb-5 flex max-w-3xl flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="font-display text-2xl font-semibold text-stone-900">
            {restaurant?.name ?? "Narada"} · Admin
          </h1>
          <p className="text-xs text-stone-500">
            Sections, dishes, availability, prices &amp; restaurant settings
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Link
            href="/admin/qr"
            className="rounded-full bg-rose-600 px-4 py-2 text-xs font-bold text-white"
          >
            QR codes
          </Link>
          <Link
            href="/waiter"
            className="rounded-full bg-stone-900 px-4 py-2 text-xs font-bold text-white"
          >
            Waiter
          </Link>
          <Link
            href="/kitchen"
            className="rounded-full bg-stone-900 px-4 py-2 text-xs font-bold text-white"
          >
            Kitchen
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
                className={inputCls}
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
                className={inputCls}
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
                className={inputCls}
              />
            </label>
            <label className="text-xs font-semibold text-stone-600">
              Game prize (free dish) 🎁
              <select
                value={restaurant.comp_item_id ?? ""}
                onChange={(e) => patchSettings({ comp_item_id: e.target.value })}
                className={inputCls}
              >
                <option value="">— default (Gulab Jamun) —</option>
                {items.map((i) => (
                  <option key={i.id} value={i.id}>
                    {i.name}
                  </option>
                ))}
              </select>
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
                className={inputCls}
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
                className={inputCls}
              />
            </label>
          </div>
        </section>
      )}

      {/* Tables: per-table UI experience (A/B testing between designs) */}
      <section className="mx-auto mb-6 max-w-3xl rounded-3xl bg-white p-5 shadow-sm ring-1 ring-stone-200/60">
        <h2 className="text-xs font-bold tracking-widest text-stone-500 uppercase">
          Tables &amp; experiences
        </h2>
        <p className="mt-1 text-[11px] text-stone-400">
          Choose which UI each table&apos;s QR opens — run Classic vs ✨ Feast Stories
          side by side and compare bills.
        </p>
        <div className="mt-2 divide-y divide-stone-100">
          {tables.map((tb) => (
            <div key={tb.id} className="flex items-center gap-3 py-2.5 text-sm">
              <span className="min-w-0 flex-1 truncate font-medium text-stone-800">
                {tb.label}
                <span className="ml-2 font-mono text-[10px] text-stone-400">/t/{tb.code}</span>
              </span>
              <select
                value={tb.ui_variant}
                onChange={async (e) => {
                  await fetch("/api/admin/tables", {
                    method: "PATCH",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ tableId: tb.id, ui_variant: e.target.value }),
                  });
                  flash("Saved");
                  load();
                }}
                className="rounded-xl bg-stone-100 px-3 py-2 text-xs font-bold outline-none"
              >
                <option value="classic">Classic list</option>
                <option value="stories">✨ Feast Stories</option>
              </select>
            </div>
          ))}
        </div>
      </section>

      {/* Staff: each person gets their own PIN; role decides which screens open */}
      <section className="mx-auto mb-6 max-w-3xl rounded-3xl bg-white p-5 shadow-sm ring-1 ring-stone-200/60">
        <div className="flex items-center justify-between">
          <h2 className="text-xs font-bold tracking-widest text-stone-500 uppercase">
            Staff &amp; logins
          </h2>
          <button
            onClick={() => setAddingStaff((v) => !v)}
            className="rounded-full bg-rose-50 px-3 py-1 text-xs font-bold text-rose-600 ring-1 ring-rose-200"
          >
            + Add staff
          </button>
        </div>
        {addingStaff && (
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              const fd = new FormData(e.currentTarget);
              const res = await fetch("/api/admin/staff", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  name: fd.get("name"),
                  role: fd.get("role"),
                  pin: fd.get("pin"),
                }),
              });
              const d = await res.json();
              flash(d.ok ? "Staff added" : (d.error ?? "Failed"));
              setAddingStaff(false);
              load();
            }}
            className="mt-3 grid gap-2 rounded-2xl bg-stone-50 p-3 sm:grid-cols-4"
          >
            <input name="name" required placeholder="Name" className={inputCls} />
            <select name="role" className={inputCls}>
              <option value="waiter">Waiter</option>
              <option value="kitchen">Kitchen</option>
              <option value="admin">Admin</option>
            </select>
            <input name="pin" required minLength={4} placeholder="PIN (4+ digits)" className={inputCls} />
            <button className="mt-1 rounded-xl bg-rose-600 px-4 py-2 text-xs font-bold text-white">
              Add
            </button>
          </form>
        )}
        <div className="mt-2 divide-y divide-stone-100">
          {staff.length === 0 && !addingStaff && (
            <p className="py-3 text-xs text-stone-400">
              No staff yet — everyone is using the owner PIN. Add waiters and cooks so
              each has their own PIN, and their PIN only opens their screen.
            </p>
          )}
          {staff.map((s) => (
            <div key={s.id} className="flex items-center gap-3 py-2.5 text-sm">
              <span
                className={`min-w-0 flex-1 truncate font-medium ${
                  s.active ? "text-stone-800" : "text-stone-400 line-through"
                }`}
              >
                {s.name}
              </span>
              <span
                className={`rounded-full px-2 py-0.5 text-[10px] font-extrabold uppercase ${
                  s.role === "admin"
                    ? "bg-rose-100 text-rose-700"
                    : s.role === "kitchen"
                      ? "bg-sky-100 text-sky-700"
                      : "bg-green-100 text-green-700"
                }`}
              >
                {s.role}
              </span>
              <span className="font-mono text-xs text-stone-500">PIN {s.pin}</span>
              <button
                onClick={async () => {
                  await fetch("/api/admin/staff", {
                    method: "PATCH",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ staffId: s.id, active: !s.active }),
                  });
                  flash(s.active ? "Login disabled" : "Login enabled");
                  load();
                }}
                className={`relative h-6 w-11 shrink-0 rounded-full transition ${
                  s.active ? "bg-green-500" : "bg-stone-300"
                }`}
                aria-label={s.active ? "disable login" : "enable login"}
              >
                <span
                  className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all ${
                    s.active ? "left-[22px]" : "left-0.5"
                  }`}
                />
              </button>
              <button
                onClick={async () => {
                  if (!confirm(`Remove ${s.name}?`)) return;
                  await fetch(`/api/admin/staff?id=${s.id}`, { method: "DELETE" });
                  flash("Staff removed");
                  load();
                }}
                className="grid h-7 w-7 place-items-center rounded-full text-xs text-stone-400 hover:bg-rose-50 hover:text-rose-600"
              >
                🗑
              </button>
            </div>
          ))}
        </div>
      </section>

      <div className="mx-auto flex max-w-3xl flex-col gap-4">
        {categories.map((cat) => {
          const list = items.filter((i) => i.category_id === cat.id);
          return (
            <section
              key={cat.id}
              className="rounded-3xl bg-white p-5 shadow-sm ring-1 ring-stone-200/60"
            >
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-bold text-stone-800">
                  {cat.emoji} {cat.name}
                  <span className="ml-2 text-xs font-medium text-stone-400">
                    {list.length} dishes
                  </span>
                </h2>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setAddingTo(addingTo === cat.id ? null : cat.id)}
                    className="rounded-full bg-rose-50 px-3 py-1 text-xs font-bold text-rose-600 ring-1 ring-rose-200"
                  >
                    + Add dish
                  </button>
                  <button
                    onClick={() => deleteSection(cat)}
                    title="Remove section"
                    className="grid h-6 w-6 place-items-center rounded-full text-xs text-stone-400 hover:bg-stone-100"
                  >
                    ✕
                  </button>
                </div>
              </div>

              {addingTo === cat.id && (
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    addItem(cat.id, e.currentTarget);
                  }}
                  className="mt-3 grid gap-2 rounded-2xl bg-stone-50 p-3 sm:grid-cols-6"
                >
                  <input name="name" required placeholder="Dish name" className={`${inputCls} sm:col-span-2`} />
                  <input name="price" required type="number" min="1" placeholder="₹" className={inputCls} />
                  <input name="emoji" placeholder="Emoji" className={inputCls} />
                  <select name="spice" className={inputCls}>
                    <option value="0">No spice</option>
                    <option value="1">Mild 🌶️</option>
                    <option value="2">Medium 🌶️🌶️</option>
                    <option value="3">Hot 🌶️🌶️🌶️</option>
                  </select>
                  <label className="flex items-center gap-2 pt-2 text-xs font-semibold text-stone-600">
                    <input name="veg" type="checkbox" defaultChecked /> Veg
                  </label>
                  <textarea
                    name="description"
                    placeholder="Description / ingredients (Narada uses this to answer questions)"
                    className={`${inputCls} sm:col-span-5`}
                    rows={2}
                  />
                  <button className="rounded-xl bg-rose-600 px-4 py-2 text-xs font-bold text-white">
                    Add
                  </button>
                </form>
              )}

              <div className="mt-2 divide-y divide-stone-100">
                {list.map((item) => (
                  <div key={item.id} className="py-2.5">
                    <div className="flex items-center gap-3">
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
                        className={`relative h-6 w-11 shrink-0 rounded-full transition ${
                          item.is_available ? "bg-green-500" : "bg-stone-300"
                        }`}
                      >
                        <span
                          className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all ${
                            item.is_available ? "left-[22px]" : "left-0.5"
                          }`}
                        />
                      </button>
                      <button
                        onClick={() => setEditing(editing === item.id ? null : item.id)}
                        title="Edit details"
                        className="grid h-7 w-7 place-items-center rounded-full text-sm hover:bg-stone-100"
                      >
                        ✎
                      </button>
                      <button
                        onClick={() => deleteItem(item)}
                        title="Remove dish"
                        className="grid h-7 w-7 place-items-center rounded-full text-xs text-stone-400 hover:bg-rose-50 hover:text-rose-600"
                      >
                        🗑
                      </button>
                    </div>

                    {editing === item.id && (
                      <div className="mt-2 grid gap-2 rounded-2xl bg-stone-50 p-3 sm:grid-cols-3">
                        <textarea
                          defaultValue={item.description ?? ""}
                          placeholder="Description / ingredients"
                          rows={2}
                          onBlur={(e) => {
                            if (e.target.value !== (item.description ?? "")) {
                              patchItem(item.id, { description: e.target.value });
                            }
                          }}
                          className={`${inputCls} sm:col-span-3`}
                        />
                        <select
                          defaultValue={String(item.spice_level)}
                          onChange={(e) => patchItem(item.id, { spice_level: Number(e.target.value) })}
                          className={inputCls}
                        >
                          <option value="0">No spice</option>
                          <option value="1">Mild 🌶️</option>
                          <option value="2">Medium 🌶️🌶️</option>
                          <option value="3">Hot 🌶️🌶️🌶️</option>
                        </select>
                        <label className="flex items-center gap-2 pt-2 text-xs font-semibold text-stone-600">
                          <input
                            type="checkbox"
                            defaultChecked={item.is_veg}
                            onChange={(e) => patchItem(item.id, { is_veg: e.target.checked })}
                          />
                          Veg
                        </label>
                        <input
                          defaultValue={item.allergens.join(", ")}
                          placeholder="Allergens (comma separated: dairy, nuts…)"
                          onBlur={(e) => {
                            const v = e.target.value.split(",").map((x) => x.trim()).filter(Boolean);
                            if (v.join(",") !== item.allergens.join(",")) {
                              patchItem(item.id, { allergens: v });
                            }
                          }}
                          className={inputCls}
                        />
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </section>
          );
        })}

        {addingSection ? (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              addSection(e.currentTarget);
            }}
            className="flex gap-2 rounded-3xl bg-white p-4 shadow-sm ring-1 ring-stone-200/60"
          >
            <input name="emoji" placeholder="🍰" className={`${inputCls} !mt-0 w-16`} />
            <input name="name" required placeholder="Section name (e.g. Desserts)" className={`${inputCls} !mt-0 flex-1`} />
            <button className="rounded-xl bg-rose-600 px-5 text-xs font-bold text-white">Add</button>
            <button
              type="button"
              onClick={() => setAddingSection(false)}
              className="rounded-xl bg-stone-100 px-4 text-xs font-bold text-stone-500"
            >
              Cancel
            </button>
          </form>
        ) : (
          <button
            onClick={() => setAddingSection(true)}
            className="rounded-3xl border-2 border-dashed border-stone-300 bg-white/50 py-4 text-sm font-bold text-stone-500 transition hover:border-rose-300 hover:text-rose-600"
          >
            + Add section
          </button>
        )}

        <p className="pb-6 text-center text-[11px] text-stone-400">
          Everything here drives the customer menu and Narada&apos;s knowledge. Sold-out
          dishes appear greyed out to customers; new dishes show in English until
          translations are added.
        </p>
      </div>
    </main>
  );
}
