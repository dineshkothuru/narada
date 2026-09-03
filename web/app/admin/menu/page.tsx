"use client";

import AdminShell from "@/components/AdminShell";
import Collapsible from "@/components/Collapsible";
import { useAdminData } from "../useAdminData";

// spice makes no sense for a mango juice — each section kind names the scale
// it actually uses, and both store the same 0-3 intensity.
const INTENSITY: Record<"food" | "drink", { label: string; options: string[] }> = {
  food: { label: "Spice", options: ["No spice", "Mild 🌶️", "Medium 🌶️🌶️", "Hot 🌶️🌶️🌶️"] },
  drink: { label: "Sweetness", options: ["No sugar", "Less sweet", "Regular", "Extra sweet"] },
};

export default function Page() {
  const {
    categories,
    items,
    editing,
    setEditing,
    addingTo,
    setAddingTo,
    addingSection,
    setAddingSection,
    patchItem,
    toggleTag,
    deleteItem,
    addItem,
    addSection,
    deleteSection,
    inputCls,
  } = useAdminData();

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
                            <label className="text-xs font-semibold text-stone-600">
                              {INTENSITY[cat.kind ?? "food"].label}
                              <select
                                defaultValue={String(item.spice_level)}
                                onChange={(e) =>
                                  patchItem(item.id, { spice_level: Number(e.target.value) })
                                }
                                className={inputCls}
                              >
                                {INTENSITY[cat.kind ?? "food"].options.map((o, i) => (
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
                                onChange={(e) => patchItem(item.id, { is_veg: e.target.checked })}
                              />
                              Veg
                            </label>
                            <label className="text-xs font-semibold text-stone-600">
                              GST %{" "}
                              <span className="font-normal text-stone-400">· 5% standard</span>
                              <select
                                defaultValue={String(item.gst_pct ?? 5)}
                                onChange={(e) =>
                                  patchItem(item.id, { gst_pct: Number(e.target.value) })
                                }
                                className={inputCls}
                              >
                                <option value="0">0%</option>
                                <option value="5">5%</option>
                                <option value="12">12%</option>
                                <option value="18">18%</option>
                                <option value="28">28%</option>
                              </select>
                            </label>
                            <input
                              defaultValue={item.allergens.join(", ")}
                              placeholder="Allergens (comma separated: dairy, nuts…)"
                              onBlur={(e) => {
                                const v = e.target.value
                                  .split(",")
                                  .map((x) => x.trim())
                                  .filter(Boolean);
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
          </div>

          {addingSection ? (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                addSection(e.currentTarget);
              }}
              className="flex gap-2 rounded-3xl card-float bg-white p-4 ring-1 ring-stone-200/80"
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
