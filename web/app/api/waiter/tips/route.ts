import { NextResponse } from "next/server";
import { tipsForDay } from "@/lib/tips-server";

// Today's tips, per waiter. The waiter screen reads its own row; the owner's
// Users screen shows the whole board. Gated to admin + waiter by the /api/waiter
// prefix in ROLE_ACCESS.
export async function GET() {
  try {
    return NextResponse.json(await tipsForDay(new Date()));
  } catch (e) {
    console.error("tips:", e);
    return NextResponse.json({ error: "failed" }, { status: 500 });
  }
}
