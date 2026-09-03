import { NextRequest, NextResponse } from "next/server";
import { sbFetch } from "@/lib/supabase-server";
import { lookupTable } from "@/lib/table-session";
import { rateLimit } from "@/lib/ratelimit";

// Customer-facing: ring the waiter for this table. One open call per table.
export async function POST(req: NextRequest) {
  if (!rateLimit(req, "waiter-call", 6)) {
    return NextResponse.json({ error: "too many requests" }, { status: 429 });
  }
  try {
    const { tableCode } = (await req.json()) as { tableCode?: string };
    if (!tableCode) {
      return NextResponse.json({ error: "tableCode required" }, { status: 400 });
    }
    const table = await lookupTable(tableCode);
    if (!table) {
      return NextResponse.json({ error: "unknown table" }, { status: 404 });
    }
    const open = await sbFetch<{ id: string }[]>(
      `waiter_calls?select=id&table_id=eq.${table.id}&status=eq.open&limit=1`,
    );
    if (open.length === 0) {
      await sbFetch(`waiter_calls`, {
        method: "POST",
        body: JSON.stringify({
          table_id: table.id,
          restaurant_id: table.restaurant_id,
        }),
      });
    }
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("waiter-call:", e);
    return NextResponse.json({ error: "failed" }, { status: 500 });
  }
}
