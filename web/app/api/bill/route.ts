import { NextRequest, NextResponse } from "next/server";
import { sbFetch } from "@/lib/supabase-server";
import { computeBill } from "@/lib/billing";
import { lookupTable } from "@/lib/table-session";
import { sessionRounds } from "@/lib/session-detail";
import { rateLimit } from "@/lib/ratelimit";
import { audit, actorFrom } from "@/lib/audit";

// Customer-facing bill preview: itemised, GST, service charge, tip.
export async function GET(req: NextRequest) {
  const sessionId = req.nextUrl.searchParams.get("session");
  const tip = Number(req.nextUrl.searchParams.get("tip") ?? 0);
  if (!sessionId) {
    return NextResponse.json({ error: "session required" }, { status: 400 });
  }
  try {
    // the rounds ride along so a staff member can see what was ordered and how
    // far each dish has got, not just the totals
    const [bill, rounds] = await Promise.all([
      computeBill(sessionId, Number.isFinite(tip) ? tip : 0),
      sessionRounds(sessionId),
    ]);
    return NextResponse.json({ ...bill, rounds });
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

    const actor = await actorFrom(req);
    // A guest must prove which table they are sitting at. This check used to be
    // conditional on tableCode being sent, which meant leaving it out skipped
    // the check entirely — a session id alone could rewrite anyone's bill.
    if (actor === "guest") {
      if (!tableCode) {
        return NextResponse.json({ error: "tableCode required" }, { status: 400 });
      }
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

    // once the counter has raised the bill the totals are frozen: a tip is
    // added by paying more, not by editing the invoice
    const locked = await sbFetch<{ bill_no: string | null }[]>(
      `sessions?select=bill_no&id=eq.${encodeURIComponent(sessionId)}&limit=1`,
    );
    if (locked.length === 0) {
      return NextResponse.json({ error: "unknown session" }, { status: 404 });
    }
    if (locked[0].bill_no) {
      return NextResponse.json(
        { error: "the bill has already been raised — ask the counter" },
        { status: 409 },
      );
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
    await audit({
      action: typeof serviceWaived === "boolean" ? "service_charge" : "tip_set",
      entity: "session",
      entityId: sessionId,
      actorRole: actor,
      detail: patch,
    });
    const bill = await computeBill(sessionId);
    return NextResponse.json(bill);
  } catch (e) {
    console.error("bill patch:", e);
    return NextResponse.json({ error: "failed" }, { status: 500 });
  }
}
