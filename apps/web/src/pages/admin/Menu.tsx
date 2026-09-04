import { useState } from "react";
import AdminShell from "@/components/AdminShell";
import Collapsible from "@/components/Collapsible";
import { ask } from "@/components/Dialogs";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
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
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => setAddingTo(addingTo === cat.id ? null : cat.id)}
                      >
                        + Add dish
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon-xs"
                        onClick={() => removeSection(cat)}
                        title="Remove section"
                      >
                        ✕
                      </Button>
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
                      className="mt-3"
                    >
                      <FieldGroup className="grid gap-2 rounded-2xl bg-stone-50 p-3 sm:grid-cols-6">
                        <Input
                          name="name"
                          required
                          aria-label="Dish name"
                          placeholder="Dish name"
                          className="sm:col-span-2"
                        />
                        <Input
                          name="price"
                          required
                          type="number"
                          min="1"
                          placeholder="₹"
                          aria-label="Price"
                        />
                        <Input name="emoji" placeholder="Emoji" aria-label="Dish emoji" />
                        <NativeSelect name="spice" aria-label={INTENSITY[cat.kind ?? "food"].label}>
                          {INTENSITY[cat.kind ?? "food"].options.map((o, i) => (
                            <NativeSelectOption key={o} value={i}>
                              {o}
                            </NativeSelectOption>
                          ))}
                        </NativeSelect>
                        <Field orientation="horizontal" className="items-center gap-2 pt-2">
                          <Checkbox id={`add-veg-${cat.id}`} name="veg" defaultChecked />
                          <FieldLabel htmlFor={`add-veg-${cat.id}`} className="text-xs">
                            Veg
                          </FieldLabel>
                        </Field>
                        <Textarea
                          name="description"
                          aria-label="Description"
                          placeholder="Description / ingredients (Narada uses this to answer questions)"
                          className="sm:col-span-5"
                          rows={2}
                        />
                        <Button type="submit" className="sm:col-span-1">
                          Add
                        </Button>
                      </FieldGroup>
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
              className="card-float"
            >
              <FieldGroup className="flex gap-2 rounded-3xl bg-white p-4 ring-1 ring-stone-200/80">
                <Input name="emoji" placeholder="🍰" aria-label="Section emoji" className="w-16" />
                <Input
                  name="name"
                  required
                  aria-label="Section name"
                  placeholder="Section name (e.g. Desserts)"
                  className="flex-1"
                />
                <NativeSelect
                  name="kind"
                  aria-label="Section type"
                  title="Which scale this section uses"
                  className="w-28"
                >
                  <NativeSelectOption value="food">Food</NativeSelectOption>
                  <NativeSelectOption value="drink">Drinks</NativeSelectOption>
                </NativeSelect>
                <Button type="submit">Add</Button>
                <Button type="button" variant="secondary" onClick={() => setAddingSection(false)}>
                  Cancel
                </Button>
              </FieldGroup>
            </form>
          ) : (
            <Button
              variant="outline"
              onClick={() => setAddingSection(true)}
              className="w-full rounded-3xl border-2 border-dashed py-4"
            >
              + Add section
            </Button>
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
        <Button
          variant="ghost"
          size="icon-sm"
          onClick={() =>
            onPatch({
              tags: item.tags.includes("chef-special")
                ? item.tags.filter((t) => t !== "chef-special")
                : [...item.tags, "chef-special"],
            })
          }
          title="Chef's Special — shows in the top carousel"
          className={`hidden sm:inline ${
            item.tags.includes("chef-special") ? "" : "opacity-25 grayscale"
          }`}
        >
          ✨
        </Button>
        <Button
          variant="ghost"
          size="icon-sm"
          onClick={() =>
            onPatch({
              tags: item.tags.includes("bestseller")
                ? item.tags.filter((t) => t !== "bestseller")
                : [...item.tags, "bestseller"],
            })
          }
          title="Bestseller — badge + carousel"
          className={`hidden sm:inline ${
            item.tags.includes("bestseller") ? "" : "opacity-25 grayscale"
          }`}
        >
          ⭐
        </Button>
        <span className="hidden text-[10px] font-bold text-stone-400 sm:inline">
          GST {item.gst_pct ?? 5}%
        </span>
        <span className="flex items-center gap-1 text-sm font-semibold text-stone-600">
          ₹
          <Input
            type="number"
            defaultValue={item.price_inr}
            onBlur={(e) => {
              const v = Number(e.target.value);
              if (v > 0 && v !== item.price_inr) onPatch({ price_inr: v });
            }}
            className="w-14 text-right sm:w-16"
          />
        </span>
        <Field orientation="horizontal" className="w-auto items-center gap-2">
          <Switch
            id={`available-${item.id}`}
            size="sm"
            checked={item.is_available}
            onCheckedChange={(available) => onPatch({ is_available: available })}
            aria-label={item.is_available ? "mark sold out" : "mark available"}
          />
          <FieldLabel htmlFor={`available-${item.id}`} className="sr-only">
            Menu availability
          </FieldLabel>
        </Field>
        <Button variant="ghost" size="icon-sm" onClick={onToggleEdit} title="Edit details">
          ✎
        </Button>
        <Button variant="ghost" size="icon-sm" onClick={onDelete} title="Remove dish">
          🗑
        </Button>
      </div>

      {editing && (
        <div className="mt-2 grid gap-2 rounded-2xl bg-stone-50 p-3 sm:grid-cols-3">
          <Textarea
            defaultValue={item.description ?? ""}
            placeholder="Description / ingredients"
            aria-label="Description"
            rows={2}
            onBlur={(e) => {
              if (e.target.value !== (item.description ?? "")) {
                onPatch({ description: e.target.value });
              }
            }}
            className="sm:col-span-3"
          />
          <Field>
            <FieldLabel>{INTENSITY[kind].label}</FieldLabel>
            <NativeSelect
              aria-label={INTENSITY[kind].label}
              defaultValue={String(item.spice_level)}
              onChange={(e) => onPatch({ spice_level: Number(e.target.value) })}
            >
              {INTENSITY[kind].options.map((o, i) => (
                <NativeSelectOption key={o} value={i}>
                  {o}
                </NativeSelectOption>
              ))}
            </NativeSelect>
          </Field>
          <Field orientation="horizontal" className="items-center gap-2 pt-2">
            <Checkbox
              id={`veg-${item.id}`}
              defaultChecked={item.is_veg}
              onCheckedChange={(checked) => onPatch({ is_veg: checked === true })}
            />
            <FieldLabel htmlFor={`veg-${item.id}`}>Veg</FieldLabel>
          </Field>
          <Field>
            <FieldLabel>
              GST % <span className="font-normal text-stone-400">· 5% standard</span>
            </FieldLabel>
            <NativeSelect
              aria-label="GST percentage"
              defaultValue={String(item.gst_pct ?? 5)}
              onChange={(e) => onPatch({ gst_pct: Number(e.target.value) })}
            >
              <NativeSelectOption value="0">0%</NativeSelectOption>
              <NativeSelectOption value="5">5%</NativeSelectOption>
              <NativeSelectOption value="12">12%</NativeSelectOption>
              <NativeSelectOption value="18">18%</NativeSelectOption>
              <NativeSelectOption value="28">28%</NativeSelectOption>
            </NativeSelect>
          </Field>
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
                <label
                  role="button"
                  tabIndex={0}
                  className="inline-flex h-8 cursor-pointer items-center justify-center rounded-lg bg-primary px-2.5 text-sm font-medium text-primary-foreground"
                  onKeyDown={(event) => {
                    if (event.key === "Enter" || event.key === " ") {
                      event.preventDefault();
                      event.currentTarget.querySelector<HTMLInputElement>("input")?.click();
                    }
                  }}
                >
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
                  <Button variant="secondary" onClick={onClearImage}>
                    Remove
                  </Button>
                )}
                <p className="max-w-48 text-[10px] leading-snug text-stone-400">
                  JPG, PNG or WebP under 4MB. Without one the customer menu falls back to the emoji.
                </p>
              </div>
            </div>
            <Input
              defaultValue={item.image_url ?? ""}
              aria-label="Image URL"
              placeholder="…or paste an image URL"
              onBlur={(e) => {
                const v = e.target.value.trim();
                if (v !== (item.image_url ?? "")) onPatch({ image_url: v || null });
              }}
            />
          </div>
          <Input
            defaultValue={item.allergens.join(", ")}
            aria-label="Allergens"
            placeholder="Allergens (comma separated: dairy, nuts…)"
            onBlur={(e) => {
              const v = e.target.value
                .split(",")
                .map((x) => x.trim())
                .filter(Boolean);
              if (v.join(",") !== item.allergens.join(",")) onPatch({ allergens: v });
            }}
          />
        </div>
      )}
    </div>
  );
}
