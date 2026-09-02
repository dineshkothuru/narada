import { NextRequest, NextResponse } from "next/server";
import { sbFetch } from "@/lib/supabase-server";

// Demo: no auth on the kitchen endpoints. Before real deployment this needs a
// staff login (Supabase Auth) — flagged in README roadmap.

export async function GET() {
  try {
    const orders = await sbFetch<unknown[]>(
      `orders?select=id,status,total_inr,placed_via,created_at,` +
        `session:sessions(table:tables(label)),items:order_items(name,qty,notes)` +
        `&status=in.(placed,preparing,served)&order=created_at.desc&limit=60`,
    );
    return NextResponse.json({ orders });
  } catch (e) {
    console.error("kitchen list:", e);
    return NextResponse.json({ error: "failed" }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const { orderId, status } = (await req.json()) as { orderId: string; status: string };
    if (!orderId || !["preparing", "served", "cancelled"].includes(status)) {
      return NextResponse.json({ error: "orderId and valid status required" }, { status: 400 });
    }
    await sbFetch(`orders?id=eq.${encodeURIComponent(orderId)}`, {
      method: "PATCH",
      body: JSON.stringify({ status }),
    });
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("kitchen update:", e);
    return NextResponse.json({ error: "failed" }, { status: 500 });
  }
}
