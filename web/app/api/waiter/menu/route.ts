import { NextRequest, NextResponse } from "next/server";
import { fetchMenu } from "@/lib/menu";

// The menu, for the pad a waiter opens over a table. Gated to admin + waiter by
// the /api/waiter prefix in ROLE_ACCESS.
export async function GET(req: NextRequest) {
  const table = req.nextUrl.searchParams.get("table");
  if (!table) return NextResponse.json({ error: "table required" }, { status: 400 });
  try {
    const menu = await fetchMenu(table);
    return NextResponse.json({
      tableLabel: menu.tableLabel,
      categories: menu.categories.map((c) => ({
        id: c.id,
        name: c.name.en,
        emoji: c.emoji,
      })),
      items: menu.items.map((m) => ({
        id: m.id,
        categoryId: m.categoryId,
        name: m.name.en,
        priceInr: m.priceInr,
        isVeg: m.isVeg,
        isAvailable: m.isAvailable,
        emoji: m.emoji,
      })),
    });
  } catch (e) {
    console.error("waiter menu:", e);
    return NextResponse.json({ error: "failed" }, { status: 500 });
  }
}
