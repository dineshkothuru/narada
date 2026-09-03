import { NextRequest, NextResponse } from "next/server";
import { sbFetch } from "@/lib/supabase-server";
import { lookupTable, getOrCreateSession } from "@/lib/table-session";
import { cancelItem } from "@/lib/cancel";
import { audit } from "@/lib/audit";
import { rateLimit } from "@/lib/ratelimit";
import type { CartLine } from "@/lib/types";

type ItemRow = { id: string; name: string; price_inr: number; gst_pct: number };
type OrderRow = { id: string; status: string; created_at: string };

export async function POST(req: NextRequest) {
  if (!rateLimit(req, "order", 15)) {
    return NextResponse.json({ error: "too many requests" }, { status: 429 });
  }
  try {
    const { tableCode, cart, placedVia, guestName, lang } = (await req.json()) as {
      tableCode: string;
      cart: CartLine[];
      placedVia?: "ui" | "anna";
      guestName?: string;
      lang?: string;
    };
    if (!tableCode || !Array.isArray(cart) || cart.length === 0) {
      return NextResponse.json({ error: "tableCode and cart required" }, { status: 400 });
    }

    // itemIds are client input — only well-formed uuids may enter the filter
    const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    const ids = [...new Set(cart.map((l) => l.itemId))].filter((id) => UUID.test(id));
    if (ids.length === 0) {
      return NextResponse.json({ error: "no valid items" }, { status: 400 });
    }

    // table+session and item prices are independent — fetch in parallel
    const table = await lookupTable(tableCode);
    if (!table) {
      return NextResponse.json({ error: "unknown table" }, { status: 404 });
    }
    const [session, items] = await Promise.all([
      getOrCreateSession(table),
      sbFetch<ItemRow[]>(`menu_items?select=id,name,price_inr,gst_pct&id=in.(${ids.join(",")})`),
    ]);
    const byId = new Map(items.map((i) => [i.id, i]));
    const lines = cart
      .map((l) => ({ ...l, qty: Math.floor(Number(l.qty)) }))
      .filter((l) => byId.has(l.itemId) && l.qty > 0 && l.qty <= 50);
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
        placed_by:
          typeof guestName === "string" && guestName.trim()
            ? guestName.trim().slice(0, 40)
            : null,
        lang: ["en", "hi", "te"].includes(lang ?? "") ? lang : null,
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
          gst_pct: byId.get(l.itemId)!.gst_pct ?? 5,
          qty: l.qty,
          notes: l.notes ?? null,
        })),
      ),
    });

    return NextResponse.json({
      orderId: order.id,
      orderNo: order.id.slice(0, 8).toUpperCase(),
      total,
      discountPct: session.discount_pct ?? 0,
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
  const session = req.nextUrl.searchParams.get("session");
  try {
    if (session) {
      // whole table session: every round with its kitchen status
      const [rounds, sessions] = await Promise.all([
        sbFetch<
          {
            id: string;
            status: string;
            total_inr: number;
            created_at: string;
            placed_by: string | null;
            items: { name: string; qty: number; status: string }[];
          }[]
        >(
          `orders?select=id,status,total_inr,created_at,placed_by,items:order_items(id,name,qty,status)&session_id=eq.${encodeURIComponent(session)}&order=created_at`,
        ),
        sbFetch<{ discount_pct: number; status: string }[]>(
          `sessions?select=discount_pct,status&id=eq.${encodeURIComponent(session)}&limit=1`,
        ),
      ]);
      return NextResponse.json({
        rounds,
        discountPct: sessions[0]?.discount_pct ?? 0,
        sessionStatus: sessions[0]?.status ?? "active",
      });
    }
    if (!id) return NextResponse.json({ error: "id or session required" }, { status: 400 });
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

// A guest changing their mind. Allowed only while the kitchen has not started
// the dish — after that the food exists, and they are asked to speak to a
// waiter, who can still void it.
export async function DELETE(req: NextRequest) {
  if (!rateLimit(req, "order-cancel", 30)) {
    return NextResponse.json({ error: "too many requests" }, { status: 429 });
  }
  const itemId = req.nextUrl.searchParams.get("itemId");
  const tableCode = req.nextUrl.searchParams.get("tableCode");
  if (!itemId || !tableCode) {
    return NextResponse.json({ error: "itemId and tableCode required" }, { status: 400 });
  }
  try {
    const table = await lookupTable(tableCode);
    if (!table) return NextResponse.json({ error: "unknown table" }, { status: 404 });

    const result = await cancelItem({
      itemId,
      by: "guest",
      guest: true,
      tableId: table.id,
    });
    if ("error" in result) {
      return NextResponse.json({ error: result.error }, { status: result.status });
    }
    await audit({
      action: "item_cancelled",
      entity: "order_item",
      entityId: itemId,
      actorRole: "guest",
      restaurantId: table.restaurant_id,
      detail: { name: result.name, by: "guest" },
    });
    return NextResponse.json(result);
  } catch (e) {
    console.error("order cancel:", e);
    return NextResponse.json({ error: "failed" }, { status: 500 });
  }
}
