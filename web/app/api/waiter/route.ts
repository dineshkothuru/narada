import { NextRequest, NextResponse } from "next/server";
import { sbFetch } from "@/lib/supabase-server";

type TableRow = { id: string; label: string; code: string };
type SessionRow = {
  id: string;
  table_id: string;
  created_at: string;
  discount_pct: number;
  orders: { id: string; status: string; total_inr: number; created_at: string }[];
  payments: { amount_inr: number; status: string }[];
};
type CallRow = { id: string; table_id: string; created_at: string };

export async function GET() {
  try {
    const [tables, sessions, calls] = await Promise.all([
      sbFetch<TableRow[]>(`tables?select=id,label,code&order=label`),
      sbFetch<SessionRow[]>(
        `sessions?select=id,table_id,created_at,discount_pct,orders(id,status,total_inr,created_at),payments(amount_inr,status)&status=eq.active`,
      ),
      sbFetch<CallRow[]>(
        `waiter_calls?select=id,table_id,created_at&status=eq.open&order=created_at`,
      ),
    ]);
    const byTable = tables.map((t) => {
      const session = sessions.find((s) => s.table_id === t.id) ?? null;
      const ordered = session
        ? session.orders
            .filter((o) => o.status !== "cancelled")
            .reduce((s, o) => s + Number(o.total_inr), 0)
        : 0;
      const paid = session
        ? session.payments
            .filter((p) => p.status === "confirmed")
            .reduce((s, p) => s + Number(p.amount_inr), 0)
        : 0;
      return {
        tableId: t.id,
        label: t.label,
        code: t.code,
        call: calls.find((c) => c.table_id === t.id) ?? null,
        session: session
          ? {
              id: session.id,
              since: session.created_at,
              orders: session.orders,
              ordered,
              paid,
              discountPct: session.discount_pct,
              // spin discount is server-tracked and applied to the bill here
              due: Math.max(
                0,
                Math.round(ordered * (1 - (session.discount_pct || 0) / 100)) - paid,
              ),
            }
          : null,
      };
    });
    return NextResponse.json({ tables: byTable });
  } catch (e) {
    console.error("waiter list:", e);
    return NextResponse.json({ error: "failed" }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const body = (await req.json()) as {
      action: "ack_call" | "mark_paid";
      callId?: string;
      sessionId?: string;
      amount?: number;
      method?: "upi_intent" | "cash";
    };
    if (body.action === "ack_call" && body.callId) {
      await sbFetch(`waiter_calls?id=eq.${encodeURIComponent(body.callId)}`, {
        method: "PATCH",
        body: JSON.stringify({ status: "done" }),
      });
      return NextResponse.json({ ok: true });
    }
    if (body.action === "mark_paid" && body.sessionId && typeof body.amount === "number") {
      const sessions = await sbFetch<{ id: string }[]>(
        `sessions?select=id&id=eq.${encodeURIComponent(body.sessionId)}&limit=1`,
      );
      if (sessions.length === 0) {
        return NextResponse.json({ error: "unknown session" }, { status: 404 });
      }
      await sbFetch(`payments`, {
        method: "POST",
        body: JSON.stringify({
          session_id: body.sessionId,
          amount_inr: body.amount,
          method: body.method === "cash" ? "cash" : "upi_intent",
          status: "confirmed",
          reference: "confirmed by staff",
        }),
      });
      await sbFetch(`sessions?id=eq.${encodeURIComponent(body.sessionId)}`, {
        method: "PATCH",
        body: JSON.stringify({ status: "closed", closed_at: new Date().toISOString() }),
      });
      return NextResponse.json({ ok: true });
    }
    return NextResponse.json({ error: "invalid action" }, { status: 400 });
  } catch (e) {
    console.error("waiter action:", e);
    return NextResponse.json({ error: "failed" }, { status: 500 });
  }
}
