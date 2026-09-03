import { NextRequest, NextResponse } from "next/server";
import { timingSafeEqual } from "crypto";
import { sbFetch } from "@/lib/supabase-server";
import { rateLimit } from "@/lib/ratelimit";
import { ADMIN_COOKIE, roleToken, type StaffRole } from "@/lib/admin-auth";
import { hashPin, hashesMatch } from "@/lib/pin";
import { audit } from "@/lib/audit";

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
      sbFetch<
        { id: string; role: StaffRole; name: string; pin: string | null; pin_hash: string | null }[]
      >(`staff?select=id,role,name,pin,pin_hash&active=eq.true`),
      sbFetch<{ id: string; admin_pin: string | null; admin_pin_hash: string | null }[]>(
        `restaurants?select=id,admin_pin,admin_pin_hash&limit=1`,
      ),
    ]);
    const restaurantId = restaurants[0]?.id ?? "";
    const attempt = await hashPin(pin, restaurantId);

    let matchedId: string | null = null;
    for (const s of staff) {
      // rows hashed already; rows still holding a plaintext PIN are upgraded
      // the first time that person signs in
      const ok = s.pin_hash
        ? hashesMatch(s.pin_hash, attempt)
        : Boolean(s.pin) && pinsMatch(s.pin!, pin);
      if (!ok) continue;
      role = s.role;
      name = s.name;
      matchedId = s.id;
      if (!s.pin_hash) {
        await sbFetch(`staff?id=eq.${encodeURIComponent(s.id)}`, {
          method: "PATCH",
          body: JSON.stringify({ pin_hash: attempt, pin: null }),
        });
      }
      break;
    }
    // the owner's built-in PIN follows the same path: hashed, and upgraded the
    // first time it is used
    const rest = restaurants[0];
    if (!role && rest) {
      const ok = rest.admin_pin_hash
        ? hashesMatch(rest.admin_pin_hash, attempt)
        : Boolean(rest.admin_pin) && pinsMatch(rest.admin_pin!, pin);
      if (ok) {
        role = "admin";
        if (!rest.admin_pin_hash) {
          await sbFetch(`restaurants?id=eq.${encodeURIComponent(rest.id)}`, {
            method: "PATCH",
            body: JSON.stringify({ admin_pin_hash: attempt, admin_pin: null }),
          });
        }
      }
    }
    if (!role) return NextResponse.json({ error: "wrong pin" }, { status: 401 });

    await audit({
      action: "staff_login",
      entity: "staff",
      entityId: matchedId,
      actorRole: role,
      actorName: name,
      restaurantId: restaurantId || null,
    });

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
