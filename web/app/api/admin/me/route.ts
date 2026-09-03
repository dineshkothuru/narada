import { NextRequest, NextResponse } from "next/server";
import { ADMIN_COOKIE, verifyToken } from "@/lib/admin-auth";

// Who is logged in — drives which nav items and screens the UI offers.
export async function GET(req: NextRequest) {
  const role = await verifyToken(req.cookies.get(ADMIN_COOKIE)?.value);
  if (!role) return NextResponse.json({ role: null }, { status: 401 });
  return NextResponse.json({ role });
}
