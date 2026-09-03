import { NextRequest, NextResponse } from "next/server";
import { sbFetch } from "@/lib/supabase-server";
import { deriveOrderStatus } from "@/lib/status";

// Demo: no auth on the kitchen endpoints. Before real deployment this needs a
// staff login (Supabase Auth) — flagged in README roadmap.

export async function GET() {
  try {
    const orders = await sbFetch<unknown[]>(
      `orders?select=id,status,total_inr,placed_via,created_at,lang,` +
        `session:sessions(table:tables(label)),items:order_items(id,name,qty,notes,status)` +
        `&status=in.(placed,preparing,ready,served)&order=created_at.desc&limit=60`,
    );
    return NextResponse.json({ orders });
  } catch (e) {
    console.error("kitchen list:", e);
    return NextResponse.json({ error: "failed" }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const { orderId, status, itemId, itemStatus } = (await req.json()) as {
      orderId?: string;
      status?: string;
      itemId?: string;
      itemStatus?: string;
    };

    // per-dish update: set the item, then derive the parent order's status
    if (itemId && itemStatus) {
      if (!["queued", "preparing", "ready", "served"].includes(itemStatus)) {
        return NextResponse.json({ error: "invalid item status" }, { status: 400 });
      }
      const rows = await sbFetch<{ order_id: string }[]>(
        `order_items?select=order_id&id=eq.${encodeURIComponent(itemId)}&limit=1`,
      );
      if (rows.length === 0) {
        return NextResponse.json({ error: "unknown item" }, { status: 404 });
      }
      await sbFetch(`order_items?id=eq.${encodeURIComponent(itemId)}`, {
        method: "PATCH",
        body: JSON.stringify({ status: itemStatus }),
      });
      const siblings = await sbFetch<{ status: string }[]>(
        `order_items?select=status&order_id=eq.${rows[0].order_id}`,
      );
      const derived = deriveOrderStatus(siblings);
      await sbFetch(`orders?id=eq.${rows[0].order_id}`, {
        method: "PATCH",
        body: JSON.stringify({ status: derived }),
      });
      return NextResponse.json({ ok: true, orderStatus: derived });
    }

    if (
      !orderId ||
      !status ||
      !["preparing", "ready", "served", "cancelled"].includes(status)
    ) {
      return NextResponse.json({ error: "orderId and valid status required" }, { status: 400 });
    }
    await sbFetch(`orders?id=eq.${encodeURIComponent(orderId)}`, {
      method: "PATCH",
      body: JSON.stringify({ status }),
    });
    // whole-ticket advance drags every dish along with it
    if (status === "preparing") {
      await sbFetch(`order_items?order_id=eq.${encodeURIComponent(orderId)}&status=eq.queued`, {
        method: "PATCH",
        body: JSON.stringify({ status: "preparing" }),
      });
    } else if (status === "ready" || status === "served") {
      await sbFetch(`order_items?order_id=eq.${encodeURIComponent(orderId)}`, {
        method: "PATCH",
        body: JSON.stringify({ status }),
      });
    }
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("kitchen update:", e);
    return NextResponse.json({ error: "failed" }, { status: 500 });
  }
}
