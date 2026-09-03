import "server-only";
import { CATEGORIES, MENU, OUTLET } from "./menu-data";
import type { Localized, MenuPayload } from "./types";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || "";
const ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY || "";

const loc = (en: string, hi?: string | null, te?: string | null): Localized => ({
  en,
  hi: hi || en,
  te: te || en,
});

async function rest<T>(path: string): Promise<T> {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    headers: { apikey: ANON_KEY, Authorization: `Bearer ${ANON_KEY}` },
    next: { revalidate: 30 },
  });
  if (!res.ok) throw new Error(`supabase ${path}: ${res.status}`);
  return res.json();
}

function fallback(tableCode: string): MenuPayload {
  return {
    outlet: {
      name: OUTLET.name,
      tagline: OUTLET.tagline,
      upiVpa: OUTLET.upiVpa,
      paymentTiming: OUTLET.paymentTiming,
    },
    tableLabel: tableCode.replace(/^t(\d+).*$/i, "Table $1"),
    uiVariant: "classic",
    categories: CATEGORIES.map((c) => ({ id: c.id, name: loc(c.name), emoji: c.emoji })),
    items: MENU.map((m) => ({
      id: m.id,
      categoryId: m.categoryId,
      name: loc(m.name),
      description: loc(m.description),
      priceInr: m.priceInr,
      isVeg: m.isVeg,
      spiceLevel: m.spiceLevel,
      allergens: m.allergens,
      tags: m.tags,
      emoji: "🍽️",
      imageUrl: null,
      isAvailable: true,
    })),
  };
}

export async function fetchMenu(tableCode: string): Promise<MenuPayload> {
  if (!SUPABASE_URL || !ANON_KEY) return fallback(tableCode);
  try {
    const tables = await rest<{ label: string; outlet_id: string; ui_variant: string | null }[]>(
      `tables?select=label,outlet_id,ui_variant&code=eq.${encodeURIComponent(tableCode)}&limit=1`,
    );
    if (tables.length === 0) return fallback(tableCode);
    const { label, outlet_id, ui_variant } = tables[0];

    const [outlets, cats, items] = await Promise.all([
      rest<{ name: string; upi_vpa: string | null; payment_timing: "pre" | "post" }[]>(
        `outlets?select=name,upi_vpa,payment_timing&id=eq.${outlet_id}&limit=1`,
      ),
      rest<
        {
          id: string;
          name: string;
          name_hi: string | null;
          name_te: string | null;
          emoji: string | null;
        }[]
      >(
        `menu_categories?select=id,name,name_hi,name_te,emoji&outlet_id=eq.${outlet_id}&order=sort_order`,
      ),
      rest<
        {
          id: string;
          category_id: string;
          name: string;
          name_hi: string | null;
          name_te: string | null;
          description: string | null;
          description_hi: string | null;
          description_te: string | null;
          price_inr: number;
          is_veg: boolean;
          spice_level: number;
          allergens: string[];
          tags: string[];
          emoji: string | null;
          image_url: string | null;
          is_available: boolean;
        }[]
      >(`menu_items?select=*&outlet_id=eq.${outlet_id}&order=sort_order`),
    ]);
    if (outlets.length === 0 || cats.length === 0 || items.length === 0) {
      return fallback(tableCode);
    }

    return {
      outlet: {
        name: outlets[0].name,
        tagline: OUTLET.tagline,
        upiVpa: outlets[0].upi_vpa || OUTLET.upiVpa,
        paymentTiming: outlets[0].payment_timing,
      },
      tableLabel: label,
      uiVariant: ui_variant === "stories" ? "stories" : "classic",
      categories: cats.map((c) => ({
        id: c.id,
        name: loc(c.name, c.name_hi, c.name_te),
        emoji: c.emoji || "🍽️",
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
  } catch (e) {
    console.error("menu fetch failed, using local fallback:", e);
    return fallback(tableCode);
  }
}
