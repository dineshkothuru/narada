import { NextRequest, NextResponse } from "next/server";
import { sbFetch } from "@/lib/supabase-server";
import { computeBill } from "@/lib/billing";
import { lookupTable } from "@/lib/table-session";
import { rateLimit } from "@/lib/ratelimit";

// Customer-facing bill preview: itemised, GST, service charge, tip.
export async function GET(req: NextRequest) {
  const sessionId = req.nextUrl.searchParams.get("session");
  const tip = Number(req.nextUrl.searchParams.get("tip") ?? 0);
  if (!sessionId) {
    return NextResponse.json({ error: "session required" }, { status: 400 });
  }
  try {
    const bill = await computeBill(sessionId, Number.isFinite(tip) ? tip : 0);
    return NextResponse.json(bill);
  } catch (e) {
    console.error("bill:", e);
    return NextResponse.json({ error: "failed" }, { status: 500 });
  }
}

// Customer asks for the service charge to be removed (their legal right in India)
export async function PATCH(req: NextRequest) {
  if (!rateLimit(req, "bill", 20)) {
    return NextResponse.json({ error: "too many requests" }, { status: 429 });
  }
  try {
    const { tableCode, sessionId, serviceWaived, tip } = (await req.json()) as {
      tableCode?: string;
      sessionId?: string;
      serviceWaived?: boolean;
      tip?: number;
    };
    if (!sessionId) {
      return NextResponse.json({ error: "sessionId required" }, { status: 400 });
    }
    // the session must belong to the table the customer is sitting at
    if (tableCode) {
      const table = await lookupTable(tableCode);
      const owned = table
        ? await sbFetch<{ id: string }[]>(
            `sessions?select=id&id=eq.${encodeURIComponent(sessionId)}&table_id=eq.${table.id}&limit=1`,
          )
        : [];
      if (owned.length === 0) {
        return NextResponse.json({ error: "not your table" }, { status: 403 });
      }
    }
    const patch: Record<string, unknown> = {};
    if (typeof serviceWaived === "boolean") patch.service_waived = serviceWaived;
    if (typeof tip === "number" && tip >= 0 && tip <= 100000) {
      patch.bill_tip = Math.round(tip);
    }
    if (Object.keys(patch).length === 0) {
      return NextResponse.json({ error: "nothing to update" }, { status: 400 });
    }
    await sbFetch(`sessions?id=eq.${encodeURIComponent(sessionId)}`, {
      method: "PATCH",
      body: JSON.stringify(patch),
    });
    const bill = await computeBill(sessionId);
    return NextResponse.json(bill);
  } catch (e) {
    console.error("bill patch:", e);
    return NextResponse.json({ error: "failed" }, { status: 500 });
  }
}
