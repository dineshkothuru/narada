import type { Repos } from "../repositories/index.js";
import { badRequest, notFound } from "../lib/http.js";
import type { CreateMenuItemInput, PatchMenuItemInput } from "@narada/shared";

const ALLOWED_TAGS = ["chef-special", "bestseller", "spicy"];

// Port of web/app/api/admin/menu/route.ts GET — the full menu, admin shaped.
export async function getAdminMenu(
  repos: Pick<Repos, "menuCategories" | "menuItems" | "outlets">,
  outletId: string,
) {
  const [categories, items, outlet] = await Promise.all([
    repos.menuCategories.listForAdmin(outletId),
    repos.menuItems.listForAdmin(outletId),
    repos.outlets.findById(outletId),
  ]);
  return {
    categories,
    items,
    outlet: outlet
      ? {
          id: outlet.id,
          name: outlet.name,
          slug: outlet.slug,
          upi_vpa: outlet.upi_vpa,
          payment_timing: outlet.payment_timing,
          gemini_api_key: outlet.gemini_api_key,
          sarvam_api_key: outlet.sarvam_api_key,
          comp_item_id: outlet.comp_item_id,
          service_charge_pct: outlet.service_charge_pct,
          gstin: outlet.gstin,
        }
      : null,
  };
}

export async function createMenuItem(
  repos: Pick<Repos, "menuCategories" | "menuItems">,
  input: CreateMenuItemInput,
  outletId: string,
): Promise<{ ok: true; id: string }> {
  const name = input.name.trim();
  if (!input.category_id || !name || input.price_inr <= 0) {
    throw badRequest("category_id, name and positive price_inr required");
  }

  const category = await repos.menuCategories.findOutletId(input.category_id, outletId);
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
  outletId: string,
): Promise<{ ok: true } | { ok: false; reason: string }> {
  if (!itemId) throw badRequest("itemId required");
  if (!(await repos.menuItems.findById(itemId, outletId))) throw notFound("unknown dish");
  try {
    await repos.menuItems.remove(itemId, outletId);
    return { ok: true };
  } catch {
    await repos.menuItems.update(itemId, { is_available: false }, outletId);
    return {
      ok: false,
      reason: "Dish has past orders — marked unavailable instead of deleting.",
    };
  }
}

export async function patchMenuItem(
  repos: Pick<Repos, "menuItems">,
  input: PatchMenuItemInput,
  outletId: string,
): Promise<{ ok: true }> {
  if (!input.itemId) throw badRequest("itemId required");
  if (!(await repos.menuItems.findById(input.itemId, outletId))) throw notFound("unknown dish");

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

  await repos.menuItems.update(input.itemId, patch, outletId);
  return { ok: true };
}
