import { NextRequest, NextResponse } from "next/server";
import { sbFetch } from "@/lib/supabase-server";
import { ADMIN_COOKIE, adminToken } from "@/lib/admin-auth";

export async function POST(req: NextRequest) {
  const { pin } = (await req.json()) as { pin?: string };
  if (!pin) return NextResponse.json({ error: "pin required" }, { status: 400 });
  try {
    const rows = await sbFetch<{ admin_pin: string }[]>(
      `restaurants?select=admin_pin&limit=1`,
    );
    if (rows.length === 0 || rows[0].admin_pin !== pin) {
      return NextResponse.json({ error: "wrong pin" }, { status: 401 });
    }
    const res = NextResponse.json({ ok: true });
    res.cookies.set(ADMIN_COOKIE, await adminToken(), {
      httpOnly: true,
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60 * 12,
    });
    return res;
  } catch (e) {
    console.error("admin login:", e);
    return NextResponse.json({ error: "login failed" }, { status: 500 });
  }
}

export async function DELETE() {
  const res = NextResponse.json({ ok: true });
  res.cookies.delete(ADMIN_COOKIE);
  return res;
}
