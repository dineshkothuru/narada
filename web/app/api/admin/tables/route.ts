import { NextResponse } from "next/server";
import { sbFetch } from "@/lib/supabase-server";

export async function GET() {
  try {
    const [tables, restaurants] = await Promise.all([
      sbFetch<{ id: string; label: string; code: string }[]>(
        `tables?select=id,label,code&order=label`,
      ),
      sbFetch<{ name: string }[]>(`restaurants?select=name&limit=1`),
    ]);
    return NextResponse.json({ tables, restaurantName: restaurants[0]?.name ?? "Narada" });
  } catch (e) {
    console.error("admin tables:", e);
    return NextResponse.json({ error: "failed" }, { status: 500 });
  }
}
