import { NextRequest, NextResponse } from "next/server";
import { fetchMenu } from "@/lib/menu";
import { transcribe, dictateToLines } from "@/lib/dictate";
import { rateLimit } from "@/lib/ratelimit";

export const maxDuration = 60;

// A waiter speaking an order at the table. Gated to admin + waiter by the
// /api/waiter prefix in ROLE_ACCESS.
export async function POST(req: NextRequest) {
  if (!rateLimit(req, "dictate", 40)) {
    return NextResponse.json({ error: "too many requests" }, { status: 429 });
  }
  try {
    const { tableCode, audio, text } = (await req.json()) as {
      tableCode?: string;
      audio?: string;
      text?: string;
    };
    if (!tableCode) {
      return NextResponse.json({ error: "tableCode required" }, { status: 400 });
    }

    const transcript = audio ? await transcribe(audio) : (text ?? "").trim();
    if (!transcript) {
      return NextResponse.json({ error: "nothing heard" }, { status: 422 });
    }

    const menu = await fetchMenu(tableCode);
    return NextResponse.json(await dictateToLines(transcript, menu));
  } catch (e) {
    console.error("dictate:", e);
    return NextResponse.json({ error: "could not read that back" }, { status: 502 });
  }
}
