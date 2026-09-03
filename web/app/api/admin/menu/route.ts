import { NextRequest, NextResponse } from "next/server";
import { sbFetch } from "@/lib/supabase-server";

export async function GET() {
  try {
    const [cats, items, restaurants] = await Promise.all([
      sbFetch<unknown[]>(`menu_categories?select=id,name,emoji&order=sort_order`),
      sbFetch<unknown[]>(
        `menu_items?select=id,category_id,name,description,price_inr,is_veg,is_available,tags,spice_level,allergens&order=sort_order`,
      ),
      sbFetch<unknown[]>(
        `restaurants?select=id,name,upi_vpa,payment_timing,admin_pin,gemini_api_key,sarvam_api_key&limit=1`,
      ),
    ]);
    return NextResponse.json({ categories: cats, items, restaurant: restaurants[0] });
  } catch (e) {
    console.error("admin menu:", e);
    return NextResponse.json({ error: "failed" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const { category_id, name, price_inr, description, is_veg, spice_level, emoji } =
      (await req.json()) as {
        category_id?: string;
        name?: string;
        price_inr?: number;
        description?: string;
        is_veg?: boolean;
        spice_level?: number;
        emoji?: string;
      };
    if (!category_id || !name?.trim() || typeof price_inr !== "number" || price_inr <= 0) {
      return NextResponse.json(
        { error: "category_id, name and positive price_inr required" },
        { status: 400 },
      );
    }
    const cats = await sbFetch<{ restaurant_id: string }[]>(
      `menu_categories?select=restaurant_id&id=eq.${encodeURIComponent(category_id)}&limit=1`,
    );
    if (cats.length === 0) {
      return NextResponse.json({ error: "unknown category" }, { status: 404 });
    }
    const rows = await sbFetch<{ id: string }[]>(`menu_items`, {
      method: "POST",
      returning: true,
      body: JSON.stringify({
        restaurant_id: cats[0].restaurant_id,
        category_id,
        name: name.trim().slice(0, 80),
        description: (description || "").slice(0, 400) || null,
        price_inr,
        is_veg: is_veg !== false,
        spice_level:
          typeof spice_level === "number" ? Math.min(3, Math.max(0, Math.floor(spice_level))) : 0,
        emoji: (emoji || "🍽️").slice(0, 8),
        allergens: [],
        tags: [],
      }),
    });
    return NextResponse.json({ ok: true, id: rows[0].id });
  } catch (e) {
    console.error("item create:", e);
    return NextResponse.json({ error: "failed" }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  const id = req.nextUrl.searchParams.get("itemId");
  if (!id) return NextResponse.json({ error: "itemId required" }, { status: 400 });
  try {
    await sbFetch(`menu_items?id=eq.${encodeURIComponent(id)}`, { method: "DELETE" });
    return NextResponse.json({ ok: true });
  } catch {
    // ordered before — keep history intact, hide from the menu instead
    try {
      await sbFetch(`menu_items?id=eq.${encodeURIComponent(id)}`, {
        method: "PATCH",
        body: JSON.stringify({ is_available: false }),
      });
      return NextResponse.json({
        ok: false,
        reason: "Dish has past orders — marked unavailable instead of deleting.",
      });
    } catch (e) {
      console.error("item delete:", e);
      return NextResponse.json({ error: "failed" }, { status: 500 });
    }
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const ALLOWED_TAGS = ["chef-special", "bestseller", "spicy"];
    const { itemId, is_available, price_inr, tags, description, spice_level, is_veg, allergens } =
      (await req.json()) as {
        itemId: string;
        is_available?: boolean;
        price_inr?: number;
        tags?: string[];
        description?: string;
        spice_level?: number;
        is_veg?: boolean;
        allergens?: string[];
      };
    if (!itemId) return NextResponse.json({ error: "itemId required" }, { status: 400 });
    const patch: Record<string, unknown> = {};
    if (typeof is_available === "boolean") patch.is_available = is_available;
    if (typeof price_inr === "number" && price_inr > 0) patch.price_inr = price_inr;
    if (Array.isArray(tags)) {
      patch.tags = tags.filter((x) => ALLOWED_TAGS.includes(x));
    }
    if (typeof description === "string") patch.description = description.slice(0, 400);
    if (typeof spice_level === "number" && spice_level >= 0 && spice_level <= 3) {
      patch.spice_level = Math.floor(spice_level);
    }
    if (typeof is_veg === "boolean") patch.is_veg = is_veg;
    if (Array.isArray(allergens)) {
      patch.allergens = allergens
        .map((a) => String(a).trim().toLowerCase().slice(0, 30))
        .filter(Boolean)
        .slice(0, 10);
    }
    if (Object.keys(patch).length === 0) {
      return NextResponse.json({ error: "nothing to update" }, { status: 400 });
    }
    await sbFetch(`menu_items?id=eq.${encodeURIComponent(itemId)}`, {
      method: "PATCH",
      body: JSON.stringify(patch),
    });
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("admin menu patch:", e);
    return NextResponse.json({ error: "failed" }, { status: 500 });
  }
}
