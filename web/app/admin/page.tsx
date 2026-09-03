"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import AdminShell from "@/components/AdminShell";
import Collapsible from "@/components/Collapsible";

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
  gst_pct: number;
};
type AdminCategory = { id: string; name: string; emoji: string | null };
type StaffRow = {
  id: string;
  name: string;
  role: "admin" | "kitchen" | "waiter" | "reception";
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
  service_charge_pct: number;
  gstin: string | null;
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
    {
      id: string;
      label: string;
      code: string;
      ui_variant: string;
      capacity: number;
    }[]
  >([]);
  const [addingStaff, setAddingStaff] = useState(false);
  const [addingTable, setAddingTable] = useState(false);

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
    patch: Partial<
      Pick<
        AdminItem,
        | "is_available"
        | "price_inr"
        | "tags"
        | "description"
        | "spice_level"
        | "is_veg"
        | "allergens"
        | "gst_pct"
      >
    >,
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
    <AdminShell>
    <main className="min-h-dvh bg-stone-100 p-4 sm:p-6">
      <div className="mx-auto flex max-w-3xl flex-col gap-3">
      <header className="mb-1 flex flex-wrap items-center justify-between gap-2">
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
            href="/admin/orders"
            className="rounded-full bg-rose-600 px-4 py-2 text-xs font-bold text-white"
          >
            Orders
          </Link>
          <Link
            href="/admin/qr"
            className="rounded-full bg-white px-4 py-2 text-xs font-bold text-stone-600 ring-1 ring-stone-200"
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
        <Collapsible title="Settings" hint="payment, UPI, GST, PIN, API keys">
          <div className="grid gap-4 sm:grid-cols-3">
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
              Service charge %
              <input
                type="number"
                min="0"
                max="20"
                step="0.5"
                defaultValue={restaurant.service_charge_pct}
                onBlur={(e) => {
                  const v = Number(e.target.value);
                  if (v !== restaurant.service_charge_pct && v >= 0 && v <= 20) {
                    patchSettings({ service_charge_pct: String(v) });
                  }
                }}
                className={inputCls}
              />
              <span className="mt-1 block text-[10px] font-normal text-stone-400">
                Applied on the bill · guests may ask to waive it
              </span>
            </label>
            <label className="text-xs font-semibold text-stone-600">
              GSTIN
              <input
                defaultValue={restaurant.gstin ?? ""}
                onBlur={(e) => {
                  if (e.target.value !== (restaurant.gstin ?? "")) {
                    patchSettings({ gstin: e.target.value });
                  }
                }}
                placeholder="29ABCDE1234F1Z5"
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
        </Collapsible>
      )}

      {/* Tables: add/rename/remove, per-table UI experience, QR links */}
      <Collapsible
        title="Tables"
        badge={String(tables.length)}
        hint="capacity, QR links, per-table theme"
        actions={
          <div className="flex items-center gap-2">
            <Link
              href="/admin/qr"
              className="rounded-full bg-white px-3 py-1 text-xs font-bold text-stone-600 ring-1 ring-stone-200"
            >
              QR codes
            </Link>
            <button
              onClick={() => setAddingTable((v) => !v)}
              className="rounded-full bg-rose-50 px-3 py-1 text-xs font-bold text-rose-600 ring-1 ring-rose-200"
            >
              + Add tables
            </button>
          </div>
        }
      >
        <p className="text-[11px] text-stone-400">
          Each table gets its own QR link and can run a different experience —
          Classic list or Feast Stories.
        </p>

        {addingTable && (
          <div className="mt-3 grid gap-2 rounded-2xl bg-stone-50 p-3 sm:grid-cols-2">
            <form
              onSubmit={async (e) => {
                e.preventDefault();
                const fd = new FormData(e.currentTarget);
                const res = await fetch("/api/admin/tables", {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({
                    count: Number(fd.get("count")),
                    prefix: fd.get("prefix"),
                    ui_variant: fd.get("variant"),
                  }),
                });
                const d = await res.json();
                flash(d.ok ? `${d.added} tables added` : (d.error ?? "Failed"));
                setAddingTable(false);
                load();
              }}
              className="rounded-xl bg-white p-3 ring-1 ring-stone-200"
            >
              <p className="text-[10px] font-bold tracking-widest text-stone-400 uppercase">
                Add several
              </p>
              <div className="mt-2 flex gap-2">
                <input
                  name="count"
                  type="number"
                  min="1"
                  max="100"
                  defaultValue={10}
                  className={`${inputCls} !mt-0 w-20`}
                />
                <input
                  name="prefix"
                  defaultValue="Table"
                  placeholder="Table"
                  className={`${inputCls} !mt-0 flex-1`}
                />
              </div>
              <select name="variant" className={inputCls}>
                <option value="classic">Classic list</option>
                <option value="stories">Feast Stories</option>
              </select>
              <button className="mt-2 w-full rounded-xl bg-rose-600 py-2 text-xs font-bold text-white">
                Add
              </button>
            </form>

            <form
              onSubmit={async (e) => {
                e.preventDefault();
                const fd = new FormData(e.currentTarget);
                const res = await fetch("/api/admin/tables", {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({
                    label: fd.get("label"),
                    ui_variant: fd.get("variant"),
                  }),
                });
                const d = await res.json();
                flash(d.ok ? "Table added" : (d.error ?? "Failed"));
                setAddingTable(false);
                load();
              }}
              className="rounded-xl bg-white p-3 ring-1 ring-stone-200"
            >
              <p className="text-[10px] font-bold tracking-widest text-stone-400 uppercase">
                Add one (custom name)
              </p>
              <input
                name="label"
                required
                placeholder="Terrace 1 / Cabin A / Bar 3"
                className={inputCls}
              />
              <select name="variant" className={inputCls}>
                <option value="classic">Classic list</option>
                <option value="stories">Feast Stories</option>
              </select>
              <button className="mt-2 w-full rounded-xl bg-stone-900 py-2 text-xs font-bold text-white">
                Add
              </button>
            </form>
          </div>
        )}

        <div className="mt-2 divide-y divide-stone-100">
          {tables.length === 0 && (
            <p className="py-4 text-center text-xs text-stone-400">
              No tables yet — add some to generate QR codes.
            </p>
          )}
          {tables.map((tb) => (
            <div key={tb.id} className="flex items-center gap-2 py-2.5 text-sm">
              <input
                defaultValue={tb.label}
                onBlur={async (e) => {
                  if (e.target.value.trim() && e.target.value !== tb.label) {
                    await fetch("/api/admin/tables", {
                      method: "PATCH",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({ tableId: tb.id, label: e.target.value }),
                    });
                    flash("Renamed");
                    load();
                  }
                }}
                className="min-w-0 flex-1 rounded-lg bg-transparent px-2 py-1 font-medium text-stone-800 outline-none hover:bg-stone-50 focus:bg-stone-50 focus:ring-2 focus:ring-rose-400"
              />
              <a
                href={`/t/${tb.code}`}
                target="_blank"
                className="hidden font-mono text-[10px] text-stone-400 underline sm:block"
              >
                /t/{tb.code}
              </a>
              <input
                type="number"
                min="1"
                max="50"
                defaultValue={tb.capacity ?? 4}
                title="seats"
                onBlur={async (e) => {
                  const v = Number(e.target.value);
                  if (v > 0 && v !== tb.capacity) {
                    await fetch("/api/admin/tables", {
                      method: "PATCH",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({ tableId: tb.id, capacity: v }),
                    });
                    flash("Saved");
                    load();
                  }
                }}
                className="w-14 shrink-0 rounded-lg bg-stone-100 px-2 py-1.5 text-center text-xs font-bold outline-none focus:ring-2 focus:ring-rose-400"
              />
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
                <option value="classic">Classic</option>
                <option value="stories">Stories</option>
              </select>
              <button
                onClick={async () => {
                  if (!confirm(`Remove ${tb.label}?`)) return;
                  const res = await fetch(`/api/admin/tables?id=${tb.id}`, {
                    method: "DELETE",
                  });
                  const d = await res.json();
                  flash(d.ok ? "Table removed" : (d.reason ?? "Failed"));
                  load();
                }}
                className="grid h-7 w-7 shrink-0 place-items-center rounded-full text-xs text-stone-400 hover:bg-rose-50 hover:text-rose-600"
              >
                Remove
              </button>
            </div>
          ))}
        </div>
      </Collapsible>

      {/* Staff: each person gets their own PIN; role decides which screens open */}
      <Collapsible
        title="Staff & logins"
        badge={String(staff.length)}
        hint="roles and PINs"
        actions={
          <button
            onClick={() => setAddingStaff((v) => !v)}
            className="rounded-full bg-rose-50 px-3 py-1 text-xs font-bold text-rose-600 ring-1 ring-rose-200"
          >
            + Add staff
          </button>
        }
      >
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
              <option value="reception">Reception / host</option>
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
      </Collapsible>

      <>
        {categories.map((cat) => {
          const list = items.filter((i) => i.category_id === cat.id);
          return (
            <Collapsible
              key={cat.id}
              title={`${cat.emoji ?? ""} ${cat.name}`}
              badge={`${list.length} dishes`}
              actions={
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
              }
            >

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
                      <span className="hidden text-[10px] font-bold text-stone-400 sm:inline">
                        GST {item.gst_pct ?? 5}%
                      </span>
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
                        <label className="text-xs font-semibold text-stone-600">
                          GST %
                          <select
                            defaultValue={String(item.gst_pct ?? 5)}
                            onChange={(e) => patchItem(item.id, { gst_pct: Number(e.target.value) })}
                            className={inputCls}
                          >
                            <option value="0">0% (exempt)</option>
                            <option value="5">5% (restaurant standard)</option>
                            <option value="12">12%</option>
                            <option value="18">18% (packaged / AC premium)</option>
                            <option value="28">28%</option>
                          </select>
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
            </Collapsible>
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
      </>
      </div>
    </main>
    </AdminShell>
  );
}
