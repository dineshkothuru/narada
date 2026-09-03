import { NextRequest, NextResponse } from "next/server";
import { sbFetch } from "@/lib/supabase-server";

const VALID_DISCOUNTS = [5, 10, 15];
const COMP_ITEM_NAME = "Gulab Jamun (2 pcs)";

type SessionRow = { id: string; discount_pct: number; comp_awarded: boolean };

async function getOrCreateSession(tableCode: string) {
  const tables = await sbFetch<{ id: string; restaurant_id: string }[]>(
    `tables?select=id,restaurant_id&code=eq.${encodeURIComponent(tableCode)}&limit=1`,
  );
  if (tables.length === 0) return null;
  const table = tables[0];
  let sessions = await sbFetch<SessionRow[]>(
    `sessions?select=id,discount_pct,comp_awarded&table_id=eq.${table.id}&status=eq.active&limit=1`,
  );
  if (sessions.length === 0) {
    sessions = await sbFetch<SessionRow[]>(`sessions`, {
      method: "POST",
      returning: true,
      body: JSON.stringify({ table_id: table.id, restaurant_id: table.restaurant_id }),
    });
  }
  return { table, session: sessions[0] };
}

// Rewards are server-tracked per table session: one spin discount, one comp.
export async function POST(req: NextRequest) {
  try {
    const { tableCode, type, pct } = (await req.json()) as {
      tableCode?: string;
      type?: "spin" | "comp";
      pct?: number;
    };
    if (!tableCode || !type) {
      return NextResponse.json({ error: "tableCode and type required" }, { status: 400 });
    }
    const ctx = await getOrCreateSession(tableCode);
    if (!ctx) return NextResponse.json({ error: "unknown table" }, { status: 404 });
    const { table, session } = ctx;

    if (type === "spin") {
      if (session.discount_pct > 0) {
        // already spun (maybe on another phone at this table) — server wins
        return NextResponse.json({ ok: false, discountPct: session.discount_pct });
      }
      const value = VALID_DISCOUNTS.includes(Number(pct)) ? Number(pct) : 0;
      if (value > 0) {
        await sbFetch(`sessions?id=eq.${session.id}`, {
          method: "PATCH",
          body: JSON.stringify({ discount_pct: value }),
        });
      }
      return NextResponse.json({ ok: true, discountPct: value });
    }

    // comp: requires at least one real order, once per session
    if (session.comp_awarded) {
      return NextResponse.json({ ok: false, reason: "already awarded" });
    }
    const orders = await sbFetch<{ id: string }[]>(
      `orders?select=id&session_id=eq.${session.id}&limit=1`,
    );
    if (orders.length === 0) {
      return NextResponse.json({ ok: false, reason: "no orders yet" }, { status: 400 });
    }
    const items = await sbFetch<{ id: string; name: string }[]>(
      `menu_items?select=id,name&name=eq.${encodeURIComponent(COMP_ITEM_NAME)}&limit=1`,
    );
    if (items.length === 0) {
      return NextResponse.json({ ok: false, reason: "comp item missing" }, { status: 500 });
    }
    const compOrders = await sbFetch<{ id: string }[]>(`orders`, {
      method: "POST",
      returning: true,
      body: JSON.stringify({
        session_id: session.id,
        restaurant_id: table.restaurant_id,
        total_inr: 0,
        placed_via: "ui",
      }),
    });
    await sbFetch(`order_items`, {
      method: "POST",
      body: JSON.stringify([
        {
          order_id: compOrders[0].id,
          menu_item_id: items[0].id,
          name: items[0].name,
          unit_price: 0,
          qty: 1,
          notes: "🎁 Complimentary — Memory Match winner",
        },
      ]),
    });
    await sbFetch(`sessions?id=eq.${session.id}`, {
      method: "PATCH",
      body: JSON.stringify({ comp_awarded: true }),
    });
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("reward:", e);
    return NextResponse.json({ error: "failed" }, { status: 500 });
  }
}
