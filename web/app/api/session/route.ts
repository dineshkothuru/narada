import { NextRequest, NextResponse } from "next/server";
import { sbFetch } from "@/lib/supabase-server";
import { lookupTable } from "@/lib/table-session";

// Customer-facing: does this table already have an active session?
// Lets a freshly-scanned phone join the group's live order view.
export async function GET(req: NextRequest) {
  const table = req.nextUrl.searchParams.get("table");
  if (!table) return NextResponse.json({ error: "table required" }, { status: 400 });
  try {
    const row = await lookupTable(table);
    if (!row) {
      return NextResponse.json({ error: "unknown table" }, { status: 404 });
    }
    const sessions = await sbFetch<{ id: string }[]>(
      `sessions?select=id&table_id=eq.${row.id}&status=eq.active&order=created_at.desc&limit=1`,
    );
    return NextResponse.json({ sessionId: sessions[0]?.id ?? null });
  } catch (e) {
    console.error("session lookup:", e);
    return NextResponse.json({ error: "failed" }, { status: 500 });
  }
}
