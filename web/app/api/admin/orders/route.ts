import { NextRequest, NextResponse } from "next/server";
import { sbFetch } from "@/lib/supabase-server";

type OrderRow = {
  id: string;
  status: string;
  total_inr: number;
  placed_via: "ui" | "anna";
  placed_by: string | null;
  created_at: string;
  session: {
    id: string;
    status: string;
    discount_pct: number;
    table: { label: string } | null;
    payments: { amount_inr: number; status: string; method: string }[];
  } | null;
  items: { name: string; qty: number; unit_price: number; status: string }[];
};

// Owner view: every order with its table, session and payment state.
// `range` = today | week | all (default today).
export async function GET(req: NextRequest) {
  const range = req.nextUrl.searchParams.get("range") ?? "today";
  try {
    let since: string | null = null;
    if (range === "today") {
      const d = new Date();
      d.setHours(0, 0, 0, 0);
      since = d.toISOString();
    } else if (range === "week") {
      since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
    }
    const orders = await sbFetch<OrderRow[]>(
      `orders?select=id,status,total_inr,placed_via,placed_by,created_at,` +
        `session:sessions(id,status,discount_pct,table:tables(label),payments(amount_inr,status,method)),` +
        `items:order_items(name,qty,unit_price,status)` +
        `${since ? `&created_at=gte.${since}` : ""}&order=created_at.desc&limit=300`,
    );

    const live = orders.filter((o) => o.status !== "cancelled");
    const gross = live.reduce((s, o) => s + Number(o.total_inr), 0);
    // one discount per session — count it once, not per round
    const sessions = new Map<string, { gross: number; pct: number; paid: number }>();
    for (const o of live) {
      const sid = o.session?.id;
      if (!sid) continue;
      const cur = sessions.get(sid) ?? {
        gross: 0,
        pct: o.session?.discount_pct ?? 0,
        paid: (o.session?.payments ?? [])
          .filter((p) => p.status === "confirmed")
          .reduce((s, p) => s + Number(p.amount_inr), 0),
      };
      cur.gross += Number(o.total_inr);
      sessions.set(sid, cur);
    }
    let netExpected = 0;
    let collected = 0;
    for (const s of sessions.values()) {
      netExpected += Math.round(s.gross * (1 - s.pct / 100));
      collected += s.paid;
    }

    const dishCount = new Map<string, number>();
    for (const o of live) {
      for (const it of o.items) {
        dishCount.set(it.name, (dishCount.get(it.name) ?? 0) + it.qty);
      }
    }
    const topDishes = [...dishCount.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([name, qty]) => ({ name, qty }));

    return NextResponse.json({
      orders,
      stats: {
        orders: live.length,
        tables: sessions.size,
        gross,
        netExpected,
        collected,
        outstanding: Math.max(0, netExpected - collected),
        byVoice: live.filter((o) => o.placed_via === "anna").length,
        avgTable: sessions.size ? Math.round(netExpected / sessions.size) : 0,
        topDishes,
      },
    });
  } catch (e) {
    console.error("admin orders:", e);
    return NextResponse.json({ error: "failed" }, { status: 500 });
  }
}
