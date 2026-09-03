import { NextRequest, NextResponse } from "next/server";
import { sbFetch } from "@/lib/supabase-server";
import { computeBill, finalizeBill } from "@/lib/billing";

type TableRow = { id: string; label: string; code: string };
type SessionRow = {
  id: string;
  table_id: string;
  created_at: string;
  discount_pct: number;
  attendant: string | null;
  orders: { id: string; status: string; total_inr: number; created_at: string }[];
  payments: { amount_inr: number; status: string }[];
};
type CallRow = { id: string; table_id: string; created_at: string };

export async function GET() {
  try {
    const [tables, sessions, calls] = await Promise.all([
      sbFetch<TableRow[]>(`tables?select=id,label,code&order=label`),
      sbFetch<SessionRow[]>(
        `sessions?select=id,table_id,created_at,discount_pct,attendant,orders(id,status,total_inr,created_at),payments(amount_inr,status)&status=eq.active`,
      ),
      sbFetch<CallRow[]>(
        `waiter_calls?select=id,table_id,created_at&status=eq.open&order=created_at`,
      ),
    ]);
    const bills = new Map<string, Awaited<ReturnType<typeof computeBill>>>();
    for (const s of sessions) {
      try {
        bills.set(s.id, await computeBill(s.id));
      } catch {}
    }
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
              gst: bills.get(session.id)?.gst ?? 0,
              service: bills.get(session.id)?.service ?? 0,
              serviceWaived: bills.get(session.id)?.serviceWaived ?? false,
              attendant: session.attendant,
              // full bill: discount + GST + service charge, minus what's paid
              due: Math.max(0, (bills.get(session.id)?.net ?? ordered) - paid),
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
      attendedBy?: string;
      sessionId?: string;
      amount?: number;
      tip?: number;
      method?: "upi_intent" | "cash";
      utr?: string;
    };
    if (body.action === "ack_call" && body.callId) {
      await sbFetch(`waiter_calls?id=eq.${encodeURIComponent(body.callId)}`, {
        method: "PATCH",
        body: JSON.stringify({
          status: "done",
          acked_at: new Date().toISOString(),
          acked_by:
            typeof body.attendedBy === "string" && body.attendedBy.trim()
              ? body.attendedBy.trim().slice(0, 40)
              : null,
        }),
      });
      // assignment is two-way: a waiter can claim a table up front, and if
      // nobody has, whoever attends the call takes it — without stealing a
      // table someone already claimed
      if (body.attendedBy?.trim() && body.sessionId) {
        await sbFetch(
          `sessions?id=eq.${encodeURIComponent(body.sessionId)}&attendant=is.null`,
          {
            method: "PATCH",
            body: JSON.stringify({ attendant: body.attendedBy.trim().slice(0, 40) }),
          },
        );
      }
      return NextResponse.json({ ok: true });
    }
    if (body.action === "mark_paid" && body.sessionId) {
      const sessions = await sbFetch<{ id: string; restaurant_id: string }[]>(
        `sessions?select=id,restaurant_id&id=eq.${encodeURIComponent(body.sessionId)}&limit=1`,
      );
      if (sessions.length === 0) {
        return NextResponse.json({ error: "unknown session" }, { status: 404 });
      }
      // freeze the bill (GST, service, tip, discount) and mint its number
      const bill = await finalizeBill(
        body.sessionId,
        typeof body.tip === "number" ? body.tip : 0,
        sessions[0].restaurant_id,
      );
      const amount = typeof body.amount === "number" ? body.amount : bill.net;
      await sbFetch(`payments`, {
        method: "POST",
        body: JSON.stringify({
          session_id: body.sessionId,
          amount_inr: amount,
          method: body.method === "cash" ? "cash" : "upi_intent",
          status: "confirmed",
          reference: [bill.billNo, body.utr ? `UTR ${body.utr.trim().slice(0, 40)}` : null, "confirmed by staff"]
            .filter(Boolean)
            .join(" · "),
        }),
      });
      await sbFetch(`sessions?id=eq.${encodeURIComponent(body.sessionId)}`, {
        method: "PATCH",
        body: JSON.stringify({ status: "closed", closed_at: new Date().toISOString() }),
      });
      return NextResponse.json({ ok: true, billNo: bill.billNo, net: bill.net });
    }
    return NextResponse.json({ error: "invalid action" }, { status: 400 });
  } catch (e) {
    console.error("waiter action:", e);
    return NextResponse.json({ error: "failed" }, { status: 500 });
  }
}
