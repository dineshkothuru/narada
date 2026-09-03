import { NextRequest, NextResponse } from "next/server";
import { sbFetch } from "@/lib/supabase-server";
import { audit, actorFrom } from "@/lib/audit";

// Taking a dish off the menu. The kitchen knows first, but the counter and the
// owner both need to say it too — and when the kitchen does it, the front of
// house has to hear about it rather than finding out from a guest.
export async function GET() {
  try {
    const [menu, recent] = await Promise.all([
      sbFetch<unknown[]>(`menu_items?select=id,name,is_available&order=name`),
      sbFetch<unknown[]>(
        `audit_log?select=action,actor_role,actor_name,detail,created_at` +
          `&action=in.(dish_sold_out,dish_back_on)&order=created_at.desc&limit=12`,
      ),
    ]);
    return NextResponse.json({ menu, recent });
  } catch (e) {
    console.error("availability:", e);
    return NextResponse.json({ error: "failed" }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const { menuItemId, available } = (await req.json()) as {
      menuItemId?: string;
      available?: boolean;
    };
    if (!menuItemId || typeof available !== "boolean") {
      return NextResponse.json(
        { error: "menuItemId and available required" },
        { status: 400 },
      );
    }
    const rows = await sbFetch<{ name: string }[]>(
      `menu_items?select=name&id=eq.${encodeURIComponent(menuItemId)}&limit=1`,
    );
    if (rows.length === 0) {
      return NextResponse.json({ error: "unknown dish" }, { status: 404 });
    }
    await sbFetch(`menu_items?id=eq.${encodeURIComponent(menuItemId)}`, {
      method: "PATCH",
      body: JSON.stringify({ is_available: available }),
    });

    const role = await actorFrom(req);
    await audit({
      action: available ? "dish_back_on" : "dish_sold_out",
      entity: "menu_item",
      entityId: menuItemId,
      actorRole: role,
      detail: { name: rows[0].name, by: role },
    });
    return NextResponse.json({ ok: true, name: rows[0].name });
  } catch (e) {
    console.error("availability update:", e);
    return NextResponse.json({ error: "failed" }, { status: 500 });
  }
}
