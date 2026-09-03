import { NextRequest, NextResponse } from "next/server";
import { sbFetch } from "@/lib/supabase-server";
import { ADMIN_COOKIE, roleToken, type StaffRole } from "@/lib/admin-auth";

export async function POST(req: NextRequest) {
  const { pin } = (await req.json()) as { pin?: string };
  if (!pin) return NextResponse.json({ error: "pin required" }, { status: 400 });
  try {
    let role: StaffRole | null = null;
    let name = "Owner";

    const staff = await sbFetch<{ role: StaffRole; name: string }[]>(
      `staff?select=role,name&pin=eq.${encodeURIComponent(pin)}&active=eq.true&limit=1`,
    );
    if (staff.length > 0) {
      role = staff[0].role;
      name = staff[0].name;
    } else {
      const rows = await sbFetch<{ admin_pin: string }[]>(
        `restaurants?select=admin_pin&limit=1`,
      );
      if (rows.length > 0 && rows[0].admin_pin === pin) role = "admin";
    }
    if (!role) return NextResponse.json({ error: "wrong pin" }, { status: 401 });

    const res = NextResponse.json({ ok: true, role, name });
    res.cookies.set(ADMIN_COOKIE, await roleToken(role), {
      httpOnly: true,
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60 * 12,
    });
    return res;
  } catch (e) {
    console.error("staff login:", e);
    return NextResponse.json({ error: "login failed" }, { status: 500 });
  }
}

export async function DELETE() {
  const res = NextResponse.json({ ok: true });
  res.cookies.delete(ADMIN_COOKIE);
  return res;
}
