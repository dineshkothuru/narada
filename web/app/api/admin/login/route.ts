import { NextRequest, NextResponse } from "next/server";
import { timingSafeEqual } from "crypto";
import { sbFetch } from "@/lib/supabase-server";
import { rateLimit } from "@/lib/ratelimit";
import { ADMIN_COOKIE, roleToken, type StaffRole } from "@/lib/admin-auth";

function pinsMatch(a: string, b: string): boolean {
  const ba = Buffer.from(a.padEnd(64, "\0"));
  const bb = Buffer.from(b.padEnd(64, "\0"));
  return a.length === b.length && timingSafeEqual(ba, bb);
}

export async function POST(req: NextRequest) {
  if (!rateLimit(req, "login", 10)) {
    return NextResponse.json({ error: "too many attempts — wait a minute" }, { status: 429 });
  }
  try {
    const { pin } = (await req.json()) as { pin?: string };
    if (!pin || typeof pin !== "string") {
      return NextResponse.json({ error: "pin required" }, { status: 400 });
    }

    let role: StaffRole | null = null;
    let name = "Owner";

    // compare in-process (constant time) instead of filtering by pin in the query
    const [staff, restaurants] = await Promise.all([
      sbFetch<{ role: StaffRole; name: string; pin: string }[]>(
        `staff?select=role,name,pin&active=eq.true`,
      ),
      sbFetch<{ admin_pin: string }[]>(`restaurants?select=admin_pin&limit=1`),
    ]);
    const match = staff.find((s) => pinsMatch(s.pin, pin));
    if (match) {
      role = match.role;
      name = match.name;
    } else if (restaurants.length > 0 && pinsMatch(restaurants[0].admin_pin, pin)) {
      role = "admin";
    }
    if (!role) return NextResponse.json({ error: "wrong pin" }, { status: 401 });

    const res = NextResponse.json({ ok: true, role, name });
    res.cookies.set(ADMIN_COOKIE, await roleToken(role), {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
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
