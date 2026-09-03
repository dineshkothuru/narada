import { NextRequest, NextResponse } from "next/server";
import { sbFetch } from "@/lib/supabase-server";
import { lookupTable, getOrCreateSession } from "@/lib/table-session";
import { rateLimit } from "@/lib/ratelimit";
import { WHEEL, spinWheel } from "@/lib/games";

const FALLBACK_COMP_NAME = "Gulab Jamun (2 pcs)";

// Rewards are server-authoritative per table session: the server draws the
// wheel prize (the client only animates it) and claims are atomic conditional
// updates, so races and forged results can't double-award.
export async function POST(req: NextRequest) {
  if (!rateLimit(req, "reward", 10)) {
    return NextResponse.json({ error: "too many requests" }, { status: 429 });
  }
  try {
    const { tableCode, type } = (await req.json()) as {
      tableCode?: string;
      type?: "spin" | "comp";
    };
    if (!tableCode || !type) {
      return NextResponse.json({ error: "tableCode and type required" }, { status: 400 });
    }
    const table = await lookupTable(tableCode);
    if (!table) return NextResponse.json({ error: "unknown table" }, { status: 404 });
    const session = await getOrCreateSession(table);

    if (type === "spin") {
      if (session.discount_pct > 0) {
        const idx = WHEEL.findIndex(
          (s) => s.reward.type === "discount" && s.reward.pct === session.discount_pct,
        );
        return NextResponse.json({
          ok: false,
          discountPct: session.discount_pct,
          sliceIndex: idx >= 0 ? idx : 0,
        });
      }
      const sliceIndex = spinWheel();
      const reward = WHEEL[sliceIndex].reward;
      const pct = reward.type === "discount" ? reward.pct : 0;
      if (pct > 0) {
        // atomic claim: only wins if nobody else set a discount meanwhile
        const claimed = await sbFetch<{ discount_pct: number }[]>(
          `sessions?id=eq.${session.id}&discount_pct=eq.0`,
          {
            method: "PATCH",
            returning: true,
            body: JSON.stringify({ discount_pct: pct }),
          },
        );
        if (claimed.length === 0) {
          const current = await sbFetch<{ discount_pct: number }[]>(
            `sessions?select=discount_pct&id=eq.${session.id}&limit=1`,
          );
          return NextResponse.json({
            ok: false,
            discountPct: current[0]?.discount_pct ?? 0,
            sliceIndex,
          });
        }
      }
      return NextResponse.json({ ok: true, discountPct: pct, sliceIndex });
    }

    // comp: claim the flag atomically BEFORE creating the ticket
    const orders = await sbFetch<{ id: string }[]>(
      `orders?select=id&session_id=eq.${session.id}&limit=1`,
    );
    if (orders.length === 0) {
      return NextResponse.json({ ok: false, reason: "no orders yet" }, { status: 400 });
    }
    const claimed = await sbFetch<{ id: string }[]>(
      `sessions?id=eq.${session.id}&comp_awarded=eq.false`,
      { method: "PATCH", returning: true, body: JSON.stringify({ comp_awarded: true }) },
    );
    if (claimed.length === 0) {
      return NextResponse.json({ ok: false, reason: "already awarded" });
    }

    // prize dish: admin-configured, falling back to the classic
    const outlets = await sbFetch<{ comp_item_id: string | null }[]>(
      `outlets?select=comp_item_id&id=eq.${table.outlet_id}&limit=1`,
    );
    let items: { id: string; name: string }[] = [];
    if (outlets[0]?.comp_item_id) {
      items = await sbFetch(`menu_items?select=id,name&id=eq.${outlets[0].comp_item_id}&limit=1`);
    }
    if (items.length === 0) {
      items = await sbFetch(
        `menu_items?select=id,name&outlet_id=eq.${table.outlet_id}&name=eq.${encodeURIComponent(FALLBACK_COMP_NAME)}&limit=1`,
      );
    }
    if (items.length === 0) {
      return NextResponse.json({ ok: false, reason: "comp item missing" }, { status: 500 });
    }
    const compOrders = await sbFetch<{ id: string }[]>(`orders`, {
      method: "POST",
      returning: true,
      body: JSON.stringify({
        session_id: session.id,
        outlet_id: table.outlet_id,
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
    return NextResponse.json({ ok: true, item: items[0].name });
  } catch (e) {
    console.error("reward:", e);
    return NextResponse.json({ error: "failed" }, { status: 500 });
  }
}
