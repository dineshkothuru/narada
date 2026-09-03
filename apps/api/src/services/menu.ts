import type { MenuPayload } from "@narada/shared";
import type { Repos } from "../repositories/index.js";

// Port of web/lib/menu.ts fetchMenu, minus the local-fixture fallback (that
// fallback existed for the Next app running with no Supabase configured at
// all; the API always has a real Postgres database, so an unknown table code
// is simply "not found" territory for the caller to handle).

const loc = (en: string, hi?: string | null, te?: string | null) => ({
  en,
  hi: hi || en,
  te: te || en,
});

// The legacy menu has no database-backed tagline; keep its customer-facing
// copy when building the SPA payload from Postgres.
const TAGLINE = "Authentic Indian kitchen";

export async function fetchMenu(
  repos: Pick<Repos, "tables" | "outlets" | "menuCategories" | "menuItems">,
  tableCode: string,
): Promise<MenuPayload | null> {
  const table = await repos.tables.findByCode(tableCode);
  if (!table) return null;

  const [outlet, cats, items] = await Promise.all([
    repos.outlets.findActiveById(table.outlet_id),
    repos.menuCategories.listByOutlet(table.outlet_id),
    repos.menuItems.listByOutlet(table.outlet_id),
  ]);
  if (!outlet || !outlet.tables_enabled || cats.length === 0 || items.length === 0) return null;

  return buildMenu(outlet, table.label, table.ui_variant, cats, items);
}

export async function fetchOutletMenu(
  repos: Pick<Repos, "outlets" | "tables" | "menuCategories" | "menuItems">,
  slug: string,
  tableCode?: string,
): Promise<MenuPayload | null> {
  const outlet = await repos.outlets.findActiveBySlug(slug);
  if (!outlet) return null;
  let tableLabel = "Takeaway";
  let uiVariant = "classic";
  if (tableCode) {
    if (!outlet.tables_enabled) return null;
    const table = await repos.tables.findByCodeForOutlet(tableCode, outlet.id);
    if (!table) return null;
    tableLabel = table.label;
    uiVariant = table.ui_variant;
  }
  const [cats, items] = await Promise.all([
    repos.menuCategories.listByOutlet(outlet.id),
    repos.menuItems.listByOutlet(outlet.id),
  ]);
  if (cats.length === 0 || items.length === 0) return null;
  return buildMenu(outlet, tableLabel, uiVariant, cats, items);
}

function buildMenu(
  outlet: {
    name: string;
    upi_vpa: string | null;
    payment_timing: string;
  },
  tableLabel: string,
  uiVariant: string,
  cats: Awaited<ReturnType<Repos["menuCategories"]["listByOutlet"]>>,
  items: Awaited<ReturnType<Repos["menuItems"]["listByOutlet"]>>,
): MenuPayload {
  return {
    outlet: {
      name: outlet.name,
      tagline: TAGLINE,
      upiVpa: outlet.upi_vpa || "",
      paymentTiming: outlet.payment_timing === "pre" ? "pre" : "post",
    },
    tableLabel,
    uiVariant: uiVariant === "stories" ? "stories" : "classic",
    categories: cats.map((c) => ({
      id: c.id,
      name: loc(c.name, c.name_hi, c.name_te),
      emoji: c.emoji || "🍽️",
      kind: c.kind === "drink" ? ("drink" as const) : ("food" as const),
    })),
    items: items.map((m) => ({
      id: m.id,
      categoryId: m.category_id,
      name: loc(m.name, m.name_hi, m.name_te),
      description: loc(m.description || "", m.description_hi, m.description_te),
      priceInr: Number(m.price_inr),
      isVeg: m.is_veg,
      spiceLevel: m.spice_level,
      allergens: m.allergens ?? [],
      tags: m.tags ?? [],
      emoji: m.emoji || "🍽️",
      imageUrl: m.image_url || null,
      isAvailable: m.is_available !== false,
    })),
  };
}
