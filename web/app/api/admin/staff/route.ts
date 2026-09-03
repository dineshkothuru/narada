import { NextRequest, NextResponse } from "next/server";
import { sbFetch } from "@/lib/supabase-server";

export async function GET() {
  try {
    const staff = await sbFetch<unknown[]>(
      `staff?select=id,name,role,pin,active,created_at&order=created_at`,
    );
    return NextResponse.json({ staff });
  } catch (e) {
    console.error("staff list:", e);
    return NextResponse.json({ error: "failed" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const { name, role, pin } = (await req.json()) as {
      name?: string;
      role?: string;
      pin?: string;
    };
    if (
      !name?.trim() ||
      !["admin", "kitchen", "waiter", "reception"].includes(role ?? "") ||
      !pin ||
      pin.length < 4
    ) {
      return NextResponse.json(
        { error: "name, role and a PIN of 4+ characters required" },
        { status: 400 },
      );
    }
    const restaurants = await sbFetch<{ id: string; admin_pin: string }[]>(
      `restaurants?select=id,admin_pin&limit=1`,
    );
    if (restaurants[0].admin_pin === pin) {
      return NextResponse.json({ error: "PIN already used by the owner" }, { status: 409 });
    }
    try {
      await sbFetch(`staff`, {
        method: "POST",
        body: JSON.stringify({
          restaurant_id: restaurants[0].id,
          name: name.trim().slice(0, 60),
          role,
          pin: pin.slice(0, 20),
        }),
      });
    } catch {
      return NextResponse.json({ error: "PIN already in use" }, { status: 409 });
    }
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("staff create:", e);
    return NextResponse.json({ error: "failed" }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const { staffId, active } = (await req.json()) as { staffId?: string; active?: boolean };
    if (!staffId || typeof active !== "boolean") {
      return NextResponse.json({ error: "staffId and active required" }, { status: 400 });
    }
    await sbFetch(`staff?id=eq.${encodeURIComponent(staffId)}`, {
      method: "PATCH",
      body: JSON.stringify({ active }),
    });
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("staff patch:", e);
    return NextResponse.json({ error: "failed" }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  const id = req.nextUrl.searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });
  try {
    await sbFetch(`staff?id=eq.${encodeURIComponent(id)}`, { method: "DELETE" });
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("staff delete:", e);
    return NextResponse.json({ error: "failed" }, { status: 500 });
  }
}
