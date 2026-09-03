import { NextRequest, NextResponse } from "next/server";
import { sbFetch } from "@/lib/supabase-server";
import { computeBill } from "@/lib/billing";
import { generateBill, recordPayment } from "@/lib/settle";

type SessionRow = {
  id: string;
  table_id: string;
  created_at: string;
  attendant: string | null;
  merged_into: string | null;
  bill_no: string | null;
  orders: { id: string; status: string; total_inr: number }[];
};

// The billing desk. Only the counter (and the owner) can take money — a waiter
// carries the bill to the table and shares it, but does not settle it.
export async function GET() {
  try {
    const [tables, sessions] = await Promise.all([
      sbFetch<{ id: string; label: string; code: string }[]>(
        `tables?select=id,label,code&order=label`,
      ),
      sbFetch<SessionRow[]>(
        `sessions?select=id,table_id,created_at,attendant,merged_into,bill_no,orders(id,status,total_inr)&status=eq.active`,
      ),
    ]);
    const labelOf = new Map(tables.map((t) => [t.id, t.label]));

    const rows = await Promise.all(
      // a merged tab bills through its primary, so only the primary shows here
      sessions
        .filter((s) => !s.merged_into)
        .map(async (s) => {
          const bill = await computeBill(s.id).catch(() => null);
          const live = s.orders.filter((o) => o.status !== "cancelled");
          const mergedLabels = sessions
            .filter((o) => o.merged_into === s.id)
            .map((o) => labelOf.get(o.table_id))
            .filter(Boolean);
          return {
            sessionId: s.id,
            tableId: s.table_id,
            label: labelOf.get(s.table_id) ?? "—",
            mergedWith: mergedLabels,
            since: s.created_at,
            attendant: s.attendant,
            billNo: s.bill_no,
            rounds: live.length,
            unserved: live.filter((o) => o.status !== "served").length,
            gross: bill?.gross ?? 0,
            discount: bill?.discount ?? 0,
            gst: bill?.gst ?? 0,
            service: bill?.service ?? 0,
            serviceWaived: bill?.serviceWaived ?? false,
            paid: bill?.paid ?? 0,
            due: bill ? Math.max(0, bill.net - bill.paid) : 0,
          };
        }),
    );

    rows.sort((a, b) => a.unserved - b.unserved || b.due - a.due);
    return NextResponse.json({ tabs: rows });
  } catch (e) {
    console.error("counter list:", e);
    return NextResponse.json({ error: "failed" }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const body = (await req.json()) as {
      action: "generate_bill" | "record_payment" | "waive_service";
      sessionId?: string;
      tip?: number;
      amount?: number;
      method?: "upi_intent" | "cash" | "card";
      utr?: string;
      collectedBy?: string;
      waived?: boolean;
    };

    if (body.action === "waive_service" && body.sessionId) {
      await sbFetch(`sessions?id=eq.${encodeURIComponent(body.sessionId)}`, {
        method: "PATCH",
        body: JSON.stringify({ service_waived: Boolean(body.waived) }),
      });
      return NextResponse.json({ ok: true });
    }

    // raising the bill is the counter's alone
    if (body.action === "generate_bill" && body.sessionId) {
      const result = await generateBill(body.sessionId);
      if ("error" in result) {
        return NextResponse.json({ error: result.error }, { status: result.status });
      }
      return NextResponse.json(result);
    }

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
    console.error("counter action:", e);
    return NextResponse.json({ error: "failed" }, { status: 500 });
  }
}
