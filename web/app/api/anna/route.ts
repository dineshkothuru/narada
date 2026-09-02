import { NextRequest, NextResponse } from "next/server";
import { fetchMenu } from "@/lib/menu";
import { askAnna } from "@/lib/anna";
import type { CartLine, ChatMessage } from "@/lib/types";

export const maxDuration = 30;

export async function POST(req: NextRequest) {
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
    const parsed = await askAnna(menu, messages, cart ?? [], language || "English");
    return NextResponse.json(parsed);
  } catch (e) {
    console.error("anna route:", e);
    return NextResponse.json({ error: "Anna is unavailable right now" }, { status: 502 });
  }
}
