import { NextRequest, NextResponse } from "next/server";
import { sbFetch } from "@/lib/supabase-server";

// Customer-facing: ring the waiter for this table. One open call per table.
export async function POST(req: NextRequest) {
  try {
    const { tableCode } = (await req.json()) as { tableCode?: string };
    if (!tableCode) {
      return NextResponse.json({ error: "tableCode required" }, { status: 400 });
    }
    const tables = await sbFetch<{ id: string; restaurant_id: string }[]>(
      `tables?select=id,restaurant_id&code=eq.${encodeURIComponent(tableCode)}&limit=1`,
    );
    if (tables.length === 0) {
      return NextResponse.json({ error: "unknown table" }, { status: 404 });
    }
    const table = tables[0];
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
