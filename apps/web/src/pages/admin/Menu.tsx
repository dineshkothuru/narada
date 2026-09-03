import { useState } from "react";
import AdminShell from "@/components/AdminShell";
import Collapsible from "@/components/Collapsible";
import { ask } from "@/components/Dialogs";
import {
  useAdminMenu,
  useAddCategory,
  useAddItem,
  useClearItemImage,
  useDeleteCategory,
  useDeleteItem,
  usePatchItem,
  useUploadItemImage,
  type AdminCategory,
  type AdminItem,
} from "@/api/hooks";

// spice makes no sense for a mango juice — each section kind names the scale
// it actually uses, and both store the same 0-3 intensity.
const INTENSITY: Record<"food" | "drink", { label: string; options: string[] }> = {
  food: { label: "Spice", options: ["No spice", "Mild 🌶️", "Medium 🌶️🌶️", "Hot 🌶️🌶️🌶️"] },
  drink: { label: "Sweetness", options: ["No sugar", "Less sweet", "Regular", "Extra sweet"] },
};

const inputCls =
  "mt-1 w-full rounded-xl bg-stone-100 px-3 py-2.5 text-sm font-semibold outline-none focus-visible:ring-2 focus-visible:ring-rose-400";

export default function AdminMenuPage() {
  const { data } = useAdminMenu();
  const categories = data?.categories ?? [];
  const items = data?.items ?? [];

  const patchItem = usePatchItem();
  const addItem = useAddItem();
  const deleteItem = useDeleteItem();
  const addCategory = useAddCategory();
  const deleteCategory = useDeleteCategory();
  const uploadImage = useUploadItemImage();
  const clearImage = useClearItemImage();

  const [editing, setEditing] = useState<string | null>(null);
  const [addingTo, setAddingTo] = useState<string | null>(null);
  const [addingSection, setAddingSection] = useState(false);

  const removeItem = async (item: AdminItem) => {
    const yes = await ask.confirm({
      title: `Remove "${item.name}"?`,
      message: "Remove this dish from the menu?",
      confirmLabel: "Remove",
      danger: true,
    });
    if (!yes) return;
    const res = await deleteItem.mutateAsync(item.id);
    ask.toast(res.ok ? "Dish removed" : (res.reason ?? "Failed"));
  };

  const removeSection = async (cat: AdminCategory) => {
    const count = items.filter((i) => i.category_id === cat.id).length;
    const yes = await ask.confirm({
      title: `Remove section "${cat.name}"${count ? ` and its ${count} dishes` : ""}?`,
      confirmLabel: "Remove section",
      danger: true,
    });
    if (!yes) return;
    const res = await deleteCategory.mutateAsync(cat.id);
    ask.toast(res.ok ? "Section removed" : (res.reason ?? "Failed"));
  };

  return (
    <AdminShell>
      <main className="min-h-dvh bg-[#eeebe8] p-4 sm:p-6">
        <div className="flex max-w-5xl flex-col gap-3">
          <header className="mb-1">
            <h1 className="font-display text-2xl font-semibold text-stone-900">Menu</h1>
            <p className="text-xs text-stone-500">Sections, dishes, prices, GST, availability</p>
          </header>

          <div className="grid gap-3 sm:grid-cols-2">
            {categories.map((cat) => {
              const list = items.filter((i) => i.category_id === cat.id);
              return (
                <Collapsible
                  key={cat.id}
                  spanWhenOpen
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
                        onClick={() => removeSection(cat)}
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
                      onSubmit={async (e) => {
                        e.preventDefault();
                        const fd = new FormData(e.currentTarget);
                        const res = await addItem.mutateAsync({
                          category_id: cat.id,
                          name: String(fd.get("name")),
                          price_inr: Number(fd.get("price")),
                          description: String(fd.get("description") ?? ""),
                          is_veg: fd.get("veg") === "on",
                          spice_level: Number(fd.get("spice") ?? 0),
                          emoji: String(fd.get("emoji") || "🍽️"),
                        });
                        ask.toast(res.ok ? "Dish added" : "Failed");
                        setAddingTo(null);
                      }}
                      className="mt-3 grid gap-2 rounded-2xl bg-stone-50 p-3 sm:grid-cols-6"
                    >
                      <input
                        name="name"
                        required
                        placeholder="Dish name"
                        className={`${inputCls} sm:col-span-2`}
                      />
                      <input
                        name="price"
                        required
                        type="number"
                        min="1"
                        placeholder="₹"
                        className={inputCls}
                      />
                      <input name="emoji" placeholder="Emoji" className={inputCls} />
                      <select
                        name="spice"
                        aria-label={INTENSITY[cat.kind ?? "food"].label}
                        className={inputCls}
                      >
                        {INTENSITY[cat.kind ?? "food"].options.map((o, i) => (
                          <option key={o} value={i}>
                            {o}
                          </option>
                        ))}
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
                      <MenuItemRow
                        key={item.id}
                        item={item}
                        kind={cat.kind ?? "food"}
                        editing={editing === item.id}
                        onToggleEdit={() => setEditing(editing === item.id ? null : item.id)}
                        onPatch={(patch) => patchItem.mutate({ itemId: item.id, patch })}
                        onDelete={() => removeItem(item)}
                        onUploadImage={(file) => uploadImage.mutate({ itemId: item.id, file })}
                        onClearImage={() => clearImage.mutate(item.id)}
                      />
                    ))}
                  </div>
                </Collapsible>
              );
            })}
          </div>

          {addingSection ? (
            <form
              onSubmit={async (e) => {
                e.preventDefault();
                const fd = new FormData(e.currentTarget);
                const res = await addCategory.mutateAsync({
                  name: String(fd.get("name")),
                  emoji: String(fd.get("emoji") || ""),
                  kind: String(fd.get("kind") || "food"),
                });
                ask.toast(res.ok ? "Section added" : "Failed");
                setAddingSection(false);
              }}
              className="card-float flex gap-2 rounded-3xl bg-white p-4 ring-1 ring-stone-200/80"
            >
              <input name="emoji" placeholder="🍰" className={`${inputCls} !mt-0 w-16`} />
              <input
                name="name"
                required
                placeholder="Section name (e.g. Desserts)"
                className={`${inputCls} !mt-0 flex-1`}
              />
              <select
                name="kind"
                title="Which scale this section uses"
                className={`${inputCls} !mt-0 w-28`}
              >
                <option value="food">Food</option>
                <option value="drink">Drinks</option>
              </select>
              <button className="rounded-xl bg-rose-600 px-5 text-xs font-bold text-white">
                Add
              </button>
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
            Everything here drives the customer menu and Narada&apos;s knowledge. Sold-out dishes
            appear greyed out to customers; new dishes show in English until translations are added.
          </p>
        </div>
      </main>
    </AdminShell>
  );
}

function MenuItemRow({
  item,
  kind,
  editing,
  onToggleEdit,
  onPatch,
  onDelete,
  onUploadImage,
  onClearImage,
}: {
  item: AdminItem;
  kind: "food" | "drink";
  editing: boolean;
  onToggleEdit: () => void;
  onPatch: (patch: Partial<AdminItem>) => void;
  onDelete: () => void;
  onUploadImage: (file: File) => void;
  onClearImage: () => void;
}) {
  return (
    <div className="py-2.5">
      <div className="flex items-center gap-3">
        {item.image_url ? (
          <img
            src={item.image_url}
            alt=""
            className="h-9 w-9 shrink-0 rounded-lg object-cover ring-1 ring-stone-200"
          />
        ) : (
          <span
            title="No photo — the customer menu shows this emoji"
            className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-stone-100 text-base"
          >
            {item.emoji ?? "🍽️"}
          </span>
        )}
        <span
          className={`min-w-0 flex-1 truncate text-sm font-medium ${
            item.is_available ? "text-stone-800" : "text-stone-400 line-through"
          }`}
        >
          {item.name}
        </span>
        <button
          onClick={() =>
            onPatch({
              tags: item.tags.includes("chef-special")
                ? item.tags.filter((t) => t !== "chef-special")
                : [...item.tags, "chef-special"],
            })
          }
          title="Chef's Special — shows in the top carousel"
          className={`hidden text-base transition active:scale-90 sm:inline ${
            item.tags.includes("chef-special") ? "" : "opacity-25 grayscale"
          }`}
        >
          ✨
        </button>
        <button
          onClick={() =>
            onPatch({
              tags: item.tags.includes("bestseller")
                ? item.tags.filter((t) => t !== "bestseller")
                : [...item.tags, "bestseller"],
            })
          }
          title="Bestseller — badge + carousel"
          className={`hidden text-base transition active:scale-90 sm:inline ${
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
              if (v > 0 && v !== item.price_inr) onPatch({ price_inr: v });
            }}
            className="w-14 rounded-lg bg-stone-100 px-1.5 py-1 text-right text-sm font-semibold outline-none focus:ring-2 focus:ring-rose-400 sm:w-16 sm:px-2"
          />
        </span>
        <button
          onClick={() => onPatch({ is_available: !item.is_available })}
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
          onClick={onToggleEdit}
          title="Edit details"
          className="grid h-7 w-7 place-items-center rounded-full text-sm hover:bg-stone-100"
        >
          ✎
        </button>
        <button
          onClick={onDelete}
          title="Remove dish"
          className="grid h-7 w-7 place-items-center rounded-full text-xs text-stone-400 hover:bg-rose-50 hover:text-rose-600"
        >
          🗑
        </button>
      </div>

      {editing && (
        <div className="mt-2 grid gap-2 rounded-2xl bg-stone-50 p-3 sm:grid-cols-3">
          <textarea
            defaultValue={item.description ?? ""}
            placeholder="Description / ingredients"
            rows={2}
            onBlur={(e) => {
              if (e.target.value !== (item.description ?? "")) {
                onPatch({ description: e.target.value });
              }
            }}
            className={`${inputCls} sm:col-span-3`}
          />
          <label className="text-xs font-semibold text-stone-600">
            {INTENSITY[kind].label}
            <select
              defaultValue={String(item.spice_level)}
              onChange={(e) => onPatch({ spice_level: Number(e.target.value) })}
              className={inputCls}
            >
              {INTENSITY[kind].options.map((o, i) => (
                <option key={o} value={i}>
                  {o}
                </option>
              ))}
            </select>
          </label>
          <label className="flex items-center gap-2 pt-2 text-xs font-semibold text-stone-600">
            <input
              type="checkbox"
              defaultChecked={item.is_veg}
              onChange={(e) => onPatch({ is_veg: e.target.checked })}
            />
            Veg
          </label>
          <label className="text-xs font-semibold text-stone-600">
            GST % <span className="font-normal text-stone-400">· 5% standard</span>
            <select
              defaultValue={String(item.gst_pct ?? 5)}
              onChange={(e) => onPatch({ gst_pct: Number(e.target.value) })}
              className={inputCls}
            >
              <option value="0">0%</option>
              <option value="5">5%</option>
              <option value="12">12%</option>
              <option value="18">18%</option>
              <option value="28">28%</option>
            </select>
          </label>
          <div className="rounded-2xl bg-white p-3 ring-1 ring-stone-200 sm:col-span-3">
            <p className="text-[10px] font-bold tracking-widest text-stone-400 uppercase">Photo</p>
            <div className="mt-2 flex flex-wrap items-center gap-3">
              {item.image_url ? (
                <img
                  src={item.image_url}
                  alt={item.name}
                  className="h-20 w-28 rounded-xl object-cover ring-1 ring-stone-200"
                />
              ) : (
                <div className="grid h-20 w-28 place-items-center rounded-xl bg-stone-100 text-2xl">
                  {item.emoji ?? "🍽️"}
                </div>
              )}
              <div className="flex flex-col gap-1.5">
                <label className="cursor-pointer rounded-xl bg-stone-900 px-4 py-2 text-center text-xs font-bold text-white">
                  {item.image_url ? "Replace photo" : "Upload photo"}
                  <input
                    type="file"
                    accept="image/jpeg,image/png,image/webp,image/avif"
                    className="hidden"
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      e.target.value = "";
                      if (f) onUploadImage(f);
                    }}
                  />
                </label>
                {item.image_url && (
                  <button
                    onClick={onClearImage}
                    className="rounded-xl bg-stone-100 px-4 py-2 text-xs font-bold text-stone-500"
                  >
                    Remove
                  </button>
                )}
                <p className="max-w-48 text-[10px] leading-snug text-stone-400">
                  JPG, PNG or WebP under 4MB. Without one the customer menu falls back to the emoji.
                </p>
              </div>
            </div>
            <input
              defaultValue={item.image_url ?? ""}
              placeholder="…or paste an image URL"
              onBlur={(e) => {
                const v = e.target.value.trim();
                if (v !== (item.image_url ?? "")) onPatch({ image_url: v || null });
              }}
              className={inputCls}
            />
          </div>
          <input
            defaultValue={item.allergens.join(", ")}
            placeholder="Allergens (comma separated: dairy, nuts…)"
            onBlur={(e) => {
              const v = e.target.value
                .split(",")
                .map((x) => x.trim())
                .filter(Boolean);
              if (v.join(",") !== item.allergens.join(",")) onPatch({ allergens: v });
            }}
            className={inputCls}
          />
        </div>
      )}
    </div>
  );
}
