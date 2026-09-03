import { NextRequest, NextResponse } from "next/server";
import { sbFetch } from "@/lib/supabase-server";

export async function POST(req: NextRequest) {
  try {
    const { name, emoji } = (await req.json()) as { name?: string; emoji?: string };
    if (!name?.trim()) {
      return NextResponse.json({ error: "name required" }, { status: 400 });
    }
    const outlets = await sbFetch<{ id: string }[]>(`outlets?select=id&limit=1`);
    const existing = await sbFetch<{ sort_order: number }[]>(
      `menu_categories?select=sort_order&order=sort_order.desc&limit=1`,
    );
    const rows = await sbFetch<{ id: string }[]>(`menu_categories`, {
      method: "POST",
      returning: true,
      body: JSON.stringify({
        outlet_id: outlets[0].id,
        name: name.trim().slice(0, 60),
        emoji: (emoji || "🍽️").slice(0, 8),
        sort_order: (existing[0]?.sort_order ?? 0) + 1,
      }),
    });
    return NextResponse.json({ ok: true, id: rows[0].id });
  } catch (e) {
    console.error("category create:", e);
    return NextResponse.json({ error: "failed" }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  const id = req.nextUrl.searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });
  try {
    // cascades to its items; blocked by FK if any item was ever ordered
    await sbFetch(`menu_categories?id=eq.${encodeURIComponent(id)}`, { method: "DELETE" });
    return NextResponse.json({ ok: true });
  } catch {
    // historical orders reference an item in this section — hide items instead
    try {
      await sbFetch(`menu_items?category_id=eq.${encodeURIComponent(id)}`, {
        method: "PATCH",
        body: JSON.stringify({ is_available: false }),
      });
      return NextResponse.json({
        ok: false,
        reason: "Section has dishes with past orders — its dishes were marked unavailable instead.",
      });
    } catch (e) {
      console.error("category delete:", e);
      return NextResponse.json({ error: "failed" }, { status: 500 });
    }
  }
}
