import { NextRequest, NextResponse } from "next/server";
import { sbFetch } from "@/lib/supabase-server";

export async function GET() {
  try {
    const [tables, restaurants] = await Promise.all([
      sbFetch<{ id: string; label: string; code: string; ui_variant: string }[]>(
        `tables?select=id,label,code,ui_variant&order=label`,
      ),
      sbFetch<{ name: string }[]>(`restaurants?select=name&limit=1`),
    ]);
    return NextResponse.json({ tables, restaurantName: restaurants[0]?.name ?? "Narada" });
  } catch (e) {
    console.error("admin tables:", e);
    return NextResponse.json({ error: "failed" }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const { tableId, ui_variant } = (await req.json()) as {
      tableId?: string;
      ui_variant?: string;
    };
    if (!tableId || !["classic", "stories"].includes(ui_variant ?? "")) {
      return NextResponse.json(
        { error: "tableId and ui_variant (classic|stories) required" },
        { status: 400 },
      );
    }
    await sbFetch(`tables?id=eq.${encodeURIComponent(tableId)}`, {
      method: "PATCH",
      body: JSON.stringify({ ui_variant }),
    });
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("table variant:", e);
    return NextResponse.json({ error: "failed" }, { status: 500 });
  }
}
