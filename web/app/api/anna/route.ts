import { NextRequest, NextResponse } from "next/server";
import { fetchMenu } from "@/lib/menu";
import { askAnna } from "@/lib/anna";
import { mockAsk } from "@/lib/mock-anna";
import { rateLimit } from "@/lib/ratelimit";
import type { CartLine, ChatMessage } from "@/lib/types";

export const maxDuration = 30;

export async function POST(req: NextRequest) {
  if (!rateLimit(req, "anna", 30)) {
    return NextResponse.json({ error: "too many requests" }, { status: 429 });
  }
  const { messages, cart, language, tableCode } = (await req.json()) as {
    messages: ChatMessage[];
    cart: CartLine[];
    language?: string;
    tableCode?: string;
  };
  if (!Array.isArray(messages) || messages.length === 0) {
    return NextResponse.json({ error: "messages required" }, { status: 400 });
  }

  try {
    const menu = await fetchMenu(tableCode || "");
    if (process.env.MOCK_AI === "1") {
      const last = messages[messages.length - 1]?.text ?? "";
      return NextResponse.json(
        mockAsk(menu, last, cart ?? [], language || "English", false),
      );
    }
    const parsed = await askAnna(menu, messages, cart ?? [], language || "English");
    return NextResponse.json(parsed);
  } catch (e) {
    console.error("anna route:", e);
    return NextResponse.json({ error: "Anna is unavailable right now" }, { status: 502 });
  }
}
