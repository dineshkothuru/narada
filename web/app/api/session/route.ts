import { NextRequest, NextResponse } from "next/server";
import { sbFetch } from "@/lib/supabase-server";

// Customer-facing: does this table already have an active session?
// Lets a freshly-scanned phone join the group's live order view.
export async function GET(req: NextRequest) {
  const table = req.nextUrl.searchParams.get("table");
  if (!table) return NextResponse.json({ error: "table required" }, { status: 400 });
  try {
    const tables = await sbFetch<{ id: string }[]>(
      `tables?select=id&code=eq.${encodeURIComponent(table)}&limit=1`,
    );
    if (tables.length === 0) {
      return NextResponse.json({ error: "unknown table" }, { status: 404 });
    }
    const sessions = await sbFetch<{ id: string }[]>(
      `sessions?select=id&table_id=eq.${tables[0].id}&status=eq.active&order=created_at.desc&limit=1`,
    );
    return NextResponse.json({ sessionId: sessions[0]?.id ?? null });
  } catch (e) {
    console.error("session lookup:", e);
    return NextResponse.json({ error: "failed" }, { status: 500 });
  }
}
