import { NextRequest, NextResponse } from "next/server";
import { sbFetch } from "@/lib/supabase-server";
import type { CartLine } from "@/lib/types";

type TableRow = { id: string; restaurant_id: string; label: string };
type SessionRow = { id: string };
type ItemRow = { id: string; name: string; price_inr: number };
type OrderRow = { id: string; status: string; created_at: string };

export async function POST(req: NextRequest) {
  try {
    const { tableCode, cart, placedVia } = (await req.json()) as {
      tableCode: string;
      cart: CartLine[];
      placedVia?: "ui" | "anna";
    };
    if (!tableCode || !Array.isArray(cart) || cart.length === 0) {
      return NextResponse.json({ error: "tableCode and cart required" }, { status: 400 });
    }

    const tables = await sbFetch<TableRow[]>(
      `tables?select=id,restaurant_id,label&code=eq.${encodeURIComponent(tableCode)}&limit=1`,
    );
    if (tables.length === 0) {
      return NextResponse.json({ error: "unknown table" }, { status: 404 });
    }
    const table = tables[0];

    let sessions = await sbFetch<SessionRow[]>(
      `sessions?select=id&table_id=eq.${table.id}&status=eq.active&limit=1`,
    );
    if (sessions.length === 0) {
      sessions = await sbFetch<SessionRow[]>(`sessions`, {
        method: "POST",
        returning: true,
        body: JSON.stringify({
          table_id: table.id,
          restaurant_id: table.restaurant_id,
        }),
      });
    }
    const session = sessions[0];

    const ids = cart.map((l) => l.itemId).join(",");
    const items = await sbFetch<ItemRow[]>(
      `menu_items?select=id,name,price_inr&id=in.(${ids})`,
    );
    const byId = new Map(items.map((i) => [i.id, i]));
    const lines = cart.filter((l) => byId.has(l.itemId) && l.qty > 0);
    if (lines.length === 0) {
      return NextResponse.json({ error: "no valid items" }, { status: 400 });
    }
    const total = lines.reduce(
      (s, l) => s + Number(byId.get(l.itemId)!.price_inr) * l.qty,
      0,
    );

    const orders = await sbFetch<OrderRow[]>(`orders`, {
      method: "POST",
      returning: true,
      body: JSON.stringify({
        session_id: session.id,
        restaurant_id: table.restaurant_id,
        total_inr: total,
        placed_via: placedVia === "anna" ? "anna" : "ui",
      }),
    });
    const order = orders[0];

    await sbFetch(`order_items`, {
      method: "POST",
      body: JSON.stringify(
        lines.map((l) => ({
          order_id: order.id,
          menu_item_id: l.itemId,
          name: byId.get(l.itemId)!.name,
          unit_price: byId.get(l.itemId)!.price_inr,
          qty: l.qty,
          notes: l.notes ?? null,
        })),
      ),
    });

    return NextResponse.json({
      orderId: order.id,
      orderNo: order.id.slice(0, 8).toUpperCase(),
      total,
      sessionId: session.id,
      tableLabel: table.label,
    });
  } catch (e) {
    console.error("order route:", e);
    return NextResponse.json({ error: "could not place order" }, { status: 500 });
  }
}

export async function GET(req: NextRequest) {
  const id = req.nextUrl.searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });
  try {
    const rows = await sbFetch<{ status: string }[]>(
      `orders?select=status&id=eq.${encodeURIComponent(id)}&limit=1`,
    );
    if (rows.length === 0) return NextResponse.json({ error: "not found" }, { status: 404 });
    return NextResponse.json({ status: rows[0].status });
  } catch (e) {
    console.error("order status:", e);
    return NextResponse.json({ error: "lookup failed" }, { status: 500 });
  }
}
