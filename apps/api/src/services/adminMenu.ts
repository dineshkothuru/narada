import type { Repos } from "../repositories/index.js";
import { badRequest, notFound } from "../lib/http.js";
import type { CreateMenuItemInput, PatchMenuItemInput } from "@narada/shared";

const ALLOWED_TAGS = ["chef-special", "bestseller", "spicy"];

// Port of web/app/api/admin/menu/route.ts GET — the full menu, admin shaped.
export async function getAdminMenu(repos: Pick<Repos, "menuCategories" | "menuItems" | "outlets">) {
  const [categories, items, outlet] = await Promise.all([
    repos.menuCategories.listForAdmin(),
    repos.menuItems.listForAdmin(),
    repos.outlets.findFirst(),
  ]);
  return { categories, items, outlet };
}

export async function createMenuItem(
  repos: Pick<Repos, "menuCategories" | "menuItems">,
  input: CreateMenuItemInput,
): Promise<{ ok: true; id: string }> {
  const name = input.name.trim();
  if (!input.category_id || !name || input.price_inr <= 0) {
    throw badRequest("category_id, name and positive price_inr required");
  }

  const category = await repos.menuCategories.findOutletId(input.category_id);
  if (!category) throw notFound("unknown category");

  const created = await repos.menuItems.create({
    outlet_id: category.outlet_id,
    category_id: input.category_id,
    name: name.slice(0, 80),
    description: (input.description || "").slice(0, 400) || null,
    price_inr: input.price_inr,
    is_veg: input.is_veg !== false,
    spice_level:
      typeof input.spice_level === "number"
        ? Math.min(3, Math.max(0, Math.floor(input.spice_level)))
        : 0,
    emoji: (input.emoji || "🍽️").slice(0, 8),
    allergens: [],
    tags: [],
  });
  return { ok: true, id: created.id };
}

// A dish with past orders can't be deleted (FK); hide it instead so history
// stays intact.
export async function deleteMenuItem(
  repos: Pick<Repos, "menuItems">,
  itemId: string,
): Promise<{ ok: true } | { ok: false; reason: string }> {
  if (!itemId) throw badRequest("itemId required");
  try {
    await repos.menuItems.remove(itemId);
    return { ok: true };
  } catch {
    await repos.menuItems.update(itemId, { is_available: false });
    return {
      ok: false,
      reason: "Dish has past orders — marked unavailable instead of deleting.",
    };
  }
}

export async function patchMenuItem(
  repos: Pick<Repos, "menuItems">,
  input: PatchMenuItemInput,
): Promise<{ ok: true }> {
  if (!input.itemId) throw badRequest("itemId required");

  const patch: Record<string, unknown> = {};
  if (typeof input.is_available === "boolean") patch.is_available = input.is_available;
  if (typeof input.price_inr === "number" && input.price_inr > 0) patch.price_inr = input.price_inr;
  if (Array.isArray(input.tags)) {
    patch.tags = input.tags.filter((x) => ALLOWED_TAGS.includes(x));
  }
  if (typeof input.description === "string") patch.description = input.description.slice(0, 400);
  if (typeof input.spice_level === "number" && input.spice_level >= 0 && input.spice_level <= 3) {
    patch.spice_level = Math.floor(input.spice_level);
  }
  if (typeof input.is_veg === "boolean") patch.is_veg = input.is_veg;
  if (typeof input.gst_pct === "number" && input.gst_pct >= 0 && input.gst_pct <= 28) {
    patch.gst_pct = input.gst_pct;
  }
  if (Array.isArray(input.allergens)) {
    patch.allergens = input.allergens
      .map((a) => String(a).trim().toLowerCase().slice(0, 30))
      .filter(Boolean)
      .slice(0, 10);
  }
  if (Object.keys(patch).length === 0) throw badRequest("nothing to update");

  await repos.menuItems.update(input.itemId, patch);
  return { ok: true };
}
