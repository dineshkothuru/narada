import { NextRequest, NextResponse } from "next/server";
import { sbFetch } from "@/lib/supabase-server";
import { computeBill } from "@/lib/billing";
import { recordPayment } from "@/lib/settle";
import { cancelItem } from "@/lib/cancel";
import { audit, actorFrom } from "@/lib/audit";
import { deriveTableStatus } from "@/lib/status";

type TableRow = {
  id: string;
  label: string;
  code: string;
  capacity: number;
  needs_cleaning: boolean;
};
type SessionRow = {
  id: string;
  table_id: string;
  created_at: string;
  discount_pct: number;
  guests: number | null;
  attendant: string | null;
  bill_no: string | null;
  orders: {
    id: string;
    status: string;
    total_inr: number;
    created_at: string;
    lang: string | null;
    items: { name: string; qty: number }[];
  }[];
  payments: { amount_inr: number; status: string }[];
};
type CallRow = { id: string; table_id: string; created_at: string };

export async function GET() {
  try {
    const [tables, sessions, calls] = await Promise.all([
      sbFetch<TableRow[]>(`tables?select=id,label,code,capacity,needs_cleaning&order=label`),
      sbFetch<SessionRow[]>(
        `sessions?select=id,table_id,created_at,discount_pct,guests,attendant,bill_no,orders(id,status,total_inr,created_at,lang,items:order_items(name,qty)),payments(amount_inr,status)&status=eq.active`,
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
        capacity: t.capacity,
        call: calls.find((c) => c.table_id === t.id) ?? null,
        // paid and emptied, but not yet wiped down and handed back
        needsCleaning: t.needs_cleaning,
        session: session
          ? {
              id: session.id,
              since: session.created_at,
              // the host seats a party before it orders — the waiter has to be
              // able to see that table, and how many people are at it
              guests: session.guests,
              status: deriveTableStatus({
                hasSession: true,
                needsCleaning: false,
                rounds: session.orders.filter((o) => o.status !== "cancelled").length,
                pending: session.orders.filter(
                  (o) => o.status !== "cancelled" && o.status !== "served",
                ).length,
                due: Math.max(0, (bills.get(session.id)?.net ?? ordered) - paid),
                billRaised: Boolean(session.bill_no),
              }),
              orders: session.orders,
              ordered,
              paid,
              discountPct: session.discount_pct,
              gst: bills.get(session.id)?.gst ?? 0,
              service: bills.get(session.id)?.service ?? 0,
              serviceWaived: bills.get(session.id)?.serviceWaived ?? false,
              attendant: session.attendant,
              billNo: session.bill_no,
              // languages this table has actually ordered in, so a waiter who
              // speaks one can choose to pick the table up
              langs: [
                ...new Set(
                  session.orders
                    .map((o) => o.lang)
                    .filter((l): l is string => Boolean(l)),
                ),
              ],
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
      action:
        | "ack_call"
        | "mark_served"
        | "clear_table"
        | "record_payment"
        | "cancel_item";
      itemId?: string;
      reason?: string;
      amount?: number;
      method?: "upi_intent" | "cash" | "card";
      utr?: string;
      collectedBy?: string;
      orderId?: string;
      tableId?: string;
      callId?: string;
      attendedBy?: string;
      sessionId?: string;
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
    // the waiter carries the food, so the waiter closes the loop
    if (body.action === "mark_served" && body.orderId) {
      await sbFetch(`orders?id=eq.${encodeURIComponent(body.orderId)}`, {
        method: "PATCH",
        body: JSON.stringify({ status: "served" }),
      });
      await sbFetch(`order_items?order_id=eq.${encodeURIComponent(body.orderId)}`, {
        method: "PATCH",
        body: JSON.stringify({ status: "served" }),
      });
      return NextResponse.json({ ok: true });
    }

    // housekeeping done — the table goes back into circulation
    if (body.action === "clear_table" && body.tableId) {
      await sbFetch(`tables?id=eq.${encodeURIComponent(body.tableId)}`, {
        method: "PATCH",
        body: JSON.stringify({ needs_cleaning: false }),
      });
      return NextResponse.json({ ok: true });
    }

    // a waiter can take a dish off the bill for a guest, including one the
    // kitchen has already started — a deliberate staff decision, recorded
    if (body.action === "cancel_item" && body.itemId) {
      const result = await cancelItem({
        itemId: body.itemId,
        by: body.attendedBy?.trim() || "staff",
        guest: false,
      });
      if ("error" in result) {
        return NextResponse.json({ error: result.error }, { status: result.status });
      }
      await audit({
        action: "item_cancelled",
        entity: "order_item",
        entityId: body.itemId,
        actorRole: await actorFrom(req),
        actorName: body.attendedBy,
        detail: { name: result.name, reason: body.reason ?? null },
      });
      return NextResponse.json(result);
    }

    // the guest can pay wherever they are — at the table by UPI, or in cash to
    // the waiter. Raising the bill stays with the counter; this only records
    // money against a bill that already exists.
    if (body.action === "record_payment" && body.sessionId) {
      const result = await recordPayment({
        sessionId: body.sessionId,
        amount: body.amount,
        method: body.method,
        utr: body.utr,
        collectedBy: body.collectedBy,
      });
      if ("error" in result) {
        return NextResponse.json({ error: result.error }, { status: result.status });
      }
      return NextResponse.json(result);
    }

    return NextResponse.json({ error: "invalid action" }, { status: 400 });
  } catch (e) {
    console.error("waiter action:", e);
    return NextResponse.json({ error: "failed" }, { status: 500 });
  }
}
