import { NextRequest, NextResponse } from "next/server";
import { CATEGORIES, MENU, RESTAURANT } from "@/lib/menu-data";
import type { AnnaResponse, CartLine, ChatMessage } from "@/lib/types";

const GEMINI_URL =
  "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent";

function buildSystemPrompt(cart: CartLine[], language: string) {
  const menuForPrompt = CATEGORIES.map((c) => ({
    category: c.name,
    items: MENU.filter((m) => m.categoryId === c.id).map((m) => ({
      id: m.id,
      name: m.name,
      description: m.description,
      price_inr: m.priceInr,
      veg: m.isVeg,
      spice_level_0_to_3: m.spiceLevel,
      allergens: m.allergens,
      tags: m.tags,
    })),
  }));

  return `You are Anna, the friendly waiter at "${RESTAURANT.name}". A customer at the table is talking to you to explore the menu and order food.

MENU (the ONLY items that exist — never invent items, prices, or ingredients):
${JSON.stringify(menuForPrompt)}

CURRENT CART:
${JSON.stringify(cart)}

RULES:
- Answer menu questions only from the menu data above. If something is not on the menu, say so warmly and suggest the closest alternative.
- The customer's app language is ${language}. Greet and reply in it by default — but if the customer writes in a different language (English, Hindi, Telugu, Hinglish, etc.), always switch to the language they actually used. Keep replies short and conversational — 1 to 3 sentences, like a real waiter speaking.
- When the customer wants to order, modify the cart via "actions". Resolve references like "that one" or "the second one" from conversation context.
- Quantities default to 1. Capture requests like "less spicy" or "no onion" in the notes field of the add action.
- Mention the price when adding an item.
- If the customer seems done ("that's all", "bas", "chalo bill"), set suggestCheckout to true and summarise the cart with the total.
- If the customer is frustrated, has a complaint, or asks for something only a human can do, tell them you are calling a waiter over.
- Never discuss anything unrelated to food, the menu, or this restaurant.

Respond with ONLY valid JSON matching this schema:
{"reply": string, "actions": [{"type": "add", "itemId": string, "qty": number, "notes"?: string} | {"type": "remove", "itemId": string} | {"type": "set_qty", "itemId": string, "qty": number}], "suggestCheckout"?: boolean}
"actions" must be [] when the customer is only asking questions. itemId must be an exact id from the menu.`;
}

export async function POST(req: NextRequest) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: "GEMINI_API_KEY not configured" }, { status: 500 });
  }

  const { messages, cart, language } = (await req.json()) as {
    messages: ChatMessage[];
    cart: CartLine[];
    language?: string;
  };
  if (!Array.isArray(messages) || messages.length === 0) {
    return NextResponse.json({ error: "messages required" }, { status: 400 });
  }

  const contents = messages.slice(-12).map((m) => ({
    role: m.role === "assistant" ? "model" : "user",
    parts: [{ text: m.text }],
  }));

  const res = await fetch(`${GEMINI_URL}?key=${apiKey}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      systemInstruction: {
        parts: [{ text: buildSystemPrompt(cart ?? [], language || "English") }],
      },
      contents,
      generationConfig: {
        responseMimeType: "application/json",
        temperature: 0.4,
        maxOutputTokens: 1024,
      },
    }),
  });

  if (!res.ok) {
    const detail = await res.text();
    console.error("Gemini error", res.status, detail.slice(0, 500));
    return NextResponse.json({ error: "Anna is unavailable right now" }, { status: 502 });
  }

  const data = await res.json();
  const raw = data?.candidates?.[0]?.content?.parts?.[0]?.text ?? "";

  let parsed: AnnaResponse;
  try {
    parsed = JSON.parse(raw);
  } catch {
    parsed = { reply: raw || "Sorry, could you say that again?", actions: [] };
  }
  if (!Array.isArray(parsed.actions)) parsed.actions = [];

  return NextResponse.json(parsed);
}
