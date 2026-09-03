import { NextRequest, NextResponse } from "next/server";
import { sbFetch } from "@/lib/supabase-server";
import { istDayStart } from "@/lib/tips";
import { buildDayReport, type PaymentRow, type SettledSession } from "@/lib/dayreport";

// One day's trading, in the restaurant's own day rather than UTC's.
export async function GET(req: NextRequest) {
  try {
    const dayParam = req.nextUrl.searchParams.get("day");
    const base = dayParam ? new Date(`${dayParam}T12:00:00+05:30`) : new Date();
    if (Number.isNaN(base.getTime())) {
      return NextResponse.json({ error: "bad date" }, { status: 400 });
    }
    const from = istDayStart(base);
    const to = new Date(from.getTime() + 24 * 60 * 60 * 1000);
    const range = `settled_at=gte.${encodeURIComponent(from.toISOString())}&settled_at=lt.${encodeURIComponent(to.toISOString())}`;

    const sessions = await sbFetch<(SettledSession & { id: string })[]>(
      `sessions?select=id,bill_no,bill_gross,bill_discount,bill_gst,bill_service,bill_tip,bill_net,guests,tip_to,settled_at&${range}`,
    );
    // payments belong to the day their bill was settled, not the day they land
    const ids = sessions.map((s) => s.id);
    const payments = ids.length
      ? await sbFetch<PaymentRow[]>(
          `payments?select=amount_inr,method,status&session_id=in.(${ids.join(",")})`,
        )
      : [];

    return NextResponse.json({
      day: from.toISOString(),
      ...buildDayReport(sessions, payments),
    });
  } catch (e) {
    console.error("day report:", e);
    return NextResponse.json({ error: "failed" }, { status: 500 });
  }
}
