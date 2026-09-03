import { NextRequest, NextResponse } from "next/server";
import { sbFetch } from "@/lib/supabase-server";

type TableRow = {
  id: string;
  label: string;
  code: string;
  ui_variant: string;
};

const slug = (s: string) =>
  s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")
    .slice(0, 24);

export async function GET() {
  try {
    const [tables, restaurants] = await Promise.all([
      sbFetch<TableRow[]>(`tables?select=id,label,code,ui_variant&order=label`),
      sbFetch<{ id: string; name: string }[]>(`restaurants?select=id,name&limit=1`),
    ]);
    return NextResponse.json({
      tables,
      restaurantName: restaurants[0]?.name ?? "Narada",
    });
  } catch (e) {
    console.error("admin tables:", e);
    return NextResponse.json({ error: "failed" }, { status: 500 });
  }
}

// Add tables: either one labelled table, or a batch ("add 10 more").
export async function POST(req: NextRequest) {
  try {
    const { label, count, prefix, ui_variant } = (await req.json()) as {
      label?: string;
      count?: number;
      prefix?: string;
      ui_variant?: string;
    };
    const restaurants = await sbFetch<{ id: string }[]>(`restaurants?select=id&limit=1`);
    if (restaurants.length === 0) {
      return NextResponse.json({ error: "no restaurant" }, { status: 404 });
    }
    const restaurantId = restaurants[0].id;
    const variant = ui_variant === "stories" ? "stories" : "classic";
    const existing = await sbFetch<{ label: string; code: string }[]>(
      `tables?select=label,code`,
    );
    const takenCodes = new Set(existing.map((t) => t.code));
    const uniqueCode = (base: string) => {
      let code = base || "table";
      let n = 2;
      while (takenCodes.has(code)) code = `${base}-${n++}`;
      takenCodes.add(code);
      return code;
    };

    const rows: Record<string, string>[] = [];
    if (typeof count === "number" && count > 0) {
      // batch: continue numbering after the highest existing "Table N"
      const nums = existing
        .map((t) => Number(/(\d+)\s*$/.exec(t.label)?.[1]))
        .filter((n) => Number.isFinite(n));
      let next = (nums.length ? Math.max(...nums) : 0) + 1;
      const name = (prefix || "Table").trim().slice(0, 20);
      for (let i = 0; i < Math.min(count, 100); i++, next++) {
        const lbl = `${name} ${next}`;
        rows.push({
          restaurant_id: restaurantId,
          label: lbl,
          code: uniqueCode(slug(lbl)),
          ui_variant: variant,
        });
      }
    } else if (label?.trim()) {
      const lbl = label.trim().slice(0, 40);
      rows.push({
        restaurant_id: restaurantId,
        label: lbl,
        code: uniqueCode(slug(lbl)),
        ui_variant: variant,
      });
    } else {
      return NextResponse.json({ error: "label or count required" }, { status: 400 });
    }

    await sbFetch(`tables`, { method: "POST", body: JSON.stringify(rows) });
    return NextResponse.json({ ok: true, added: rows.length });
  } catch (e) {
    console.error("table create:", e);
    return NextResponse.json({ error: "failed" }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const { tableId, ui_variant, label } = (await req.json()) as {
      tableId?: string;
      ui_variant?: string;
      label?: string;
    };
    if (!tableId) {
      return NextResponse.json({ error: "tableId required" }, { status: 400 });
    }
    const patch: Record<string, unknown> = {};
    if (ui_variant && ["classic", "stories"].includes(ui_variant)) {
      patch.ui_variant = ui_variant;
    }
    if (typeof label === "string" && label.trim()) {
      patch.label = label.trim().slice(0, 40);
    }
    if (Object.keys(patch).length === 0) {
      return NextResponse.json({ error: "nothing to update" }, { status: 400 });
    }
    await sbFetch(`tables?id=eq.${encodeURIComponent(tableId)}`, {
      method: "PATCH",
      body: JSON.stringify(patch),
    });
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("table patch:", e);
    return NextResponse.json({ error: "failed" }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  const id = req.nextUrl.searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });
  try {
    const active = await sbFetch<{ id: string }[]>(
      `sessions?select=id&table_id=eq.${encodeURIComponent(id)}&status=eq.active&limit=1`,
    );
    if (active.length > 0) {
      return NextResponse.json(
        { ok: false, reason: "Table has an open tab — settle it first." },
        { status: 409 },
      );
    }
    await sbFetch(`tables?id=eq.${encodeURIComponent(id)}`, { method: "DELETE" });
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json(
      { ok: false, reason: "Table has order history — it can't be deleted." },
      { status: 409 },
    );
  }
}
