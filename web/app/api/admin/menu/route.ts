import { NextRequest, NextResponse } from "next/server";
import { sbFetch } from "@/lib/supabase-server";

export async function GET() {
  try {
    const [cats, items, restaurants] = await Promise.all([
      sbFetch<unknown[]>(`menu_categories?select=id,name,emoji&order=sort_order`),
      sbFetch<unknown[]>(
        `menu_items?select=id,category_id,name,price_inr,is_veg,is_available,tags&order=sort_order`,
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

export async function PATCH(req: NextRequest) {
  try {
    const ALLOWED_TAGS = ["chef-special", "bestseller", "spicy"];
    const { itemId, is_available, price_inr, tags } = (await req.json()) as {
      itemId: string;
      is_available?: boolean;
      price_inr?: number;
      tags?: string[];
    };
    if (!itemId) return NextResponse.json({ error: "itemId required" }, { status: 400 });
    const patch: Record<string, unknown> = {};
    if (typeof is_available === "boolean") patch.is_available = is_available;
    if (typeof price_inr === "number" && price_inr > 0) patch.price_inr = price_inr;
    if (Array.isArray(tags)) {
      patch.tags = tags.filter((x) => ALLOWED_TAGS.includes(x));
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
