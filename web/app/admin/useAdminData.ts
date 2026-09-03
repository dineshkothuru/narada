"use client";

import { useCallback, useEffect, useState } from "react";
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
  gst_pct: number;
  image_url: string | null;
  emoji: string | null;
};
type AdminCategory = {
  id: string;
  name: string;
  emoji: string | null;
  kind: "food" | "drink";
};
type StaffRow = {
  id: string;
  name: string;
  role: "admin" | "kitchen" | "waiter" | "reception";
  pin: string;
  active: boolean;
};
type AdminOutlet = {
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

// Every owner screen reads and writes the same outlet record, so the state
// and the save handlers live here once instead of being copied per page.
export function useAdminData() {
  const router = useRouter();
  const [categories, setCategories] = useState<AdminCategory[]>([]);
  const [items, setItems] = useState<AdminItem[]>([]);
  const [outlet, setOutlet] = useState<AdminOutlet | null>(null);
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
      setOutlet(d.outlet ?? null);
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

  // dish photos go through their own endpoint because they are multipart
  const uploadImage = async (itemId: string, file: File) => {
    const body = new FormData();
    body.append("itemId", itemId);
    body.append("file", file);
    const res = await fetch("/api/admin/image", { method: "POST", body });
    const d = await res.json().catch(() => ({}));
    if (res.ok) {
      setItems((prev) => prev.map((i) => (i.id === itemId ? { ...i, image_url: d.imageUrl } : i)));
      flash("Photo updated");
    } else {
      flash(d.error ?? "Upload failed");
    }
  };

  const clearImage = async (itemId: string) => {
    await fetch(`/api/admin/image?itemId=${encodeURIComponent(itemId)}`, {
      method: "DELETE",
    });
    setItems((prev) => prev.map((i) => (i.id === itemId ? { ...i, image_url: null } : i)));
    flash("Photo removed");
  };

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
        | "image_url"
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
    const tags = item.tags.includes(tag) ? item.tags.filter((x) => x !== tag) : [...item.tags, tag];
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
      body: JSON.stringify({
        name: fd.get("name"),
        emoji: fd.get("emoji"),
        kind: fd.get("kind"),
      }),
    });
    const d = await res.json();
    flash(d.ok ? "Section added" : (d.error ?? "Failed"));
    setAddingSection(false);
    load();
  };

  const deleteSection = async (cat: AdminCategory) => {
    const count = items.filter((i) => i.category_id === cat.id).length;
    if (!confirm(`Remove section "${cat.name}"${count ? ` and its ${count} dishes` : ""}?`)) return;
    const res = await fetch(`/api/admin/categories?id=${cat.id}`, { method: "DELETE" });
    const d = await res.json();
    flash(d.ok ? "Section removed" : (d.reason ?? "Failed"));
    load();
  };

  const patchSettings = async (patch: Record<string, string>) => {
    if (!outlet) return;
    await fetch("/api/admin/settings", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ outletId: outlet.id, ...patch }),
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

  return {
    categories,
    setCategories,
    items,
    setItems,
    outlet,
    setOutlet,
    saved,
    setSaved,
    editing,
    setEditing,
    addingTo,
    setAddingTo,
    addingSection,
    setAddingSection,
    staff,
    setStaff,
    tables,
    setTables,
    addingStaff,
    setAddingStaff,
    addingTable,
    setAddingTable,
    load,
    flash,
    patchItem,
    uploadImage,
    clearImage,
    toggleTag,
    deleteItem,
    addItem,
    addSection,
    deleteSection,
    patchSettings,
    logout,
    inputCls,
  };
}
