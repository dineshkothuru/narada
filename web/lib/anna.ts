import "server-only";
import { getApiKeys } from "./keys";
import type { AnnaResponse, CartLine, ChatMessage, MenuPayload } from "./types";

const GEMINI_URL =
  "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent";

function buildSystemPrompt(menu: MenuPayload, cart: CartLine[], language: string) {
  const menuForPrompt = menu.categories.map((c) => ({
    category: c.name.en,
    items: menu.items
      .filter((m) => m.categoryId === c.id)
      .map((m) => ({
        id: m.id,
        name: m.name.en,
        name_hindi: m.name.hi,
        name_telugu: m.name.te,
        description: m.description.en,
        price_inr: m.priceInr,
        veg: m.isVeg,
        spice_level_0_to_3: m.spiceLevel,
        allergens: m.allergens,
        tags: m.tags,
      })),
  }));

  return `You are Narada, the friendly waiter at "${menu.restaurant.name}". A customer at the table is talking to you to explore the menu and order food. Customers may call you Narada, anna, or bhaiya — all mean you.

MENU (the ONLY items that exist — never invent items, prices, or ingredients):
${JSON.stringify(menuForPrompt)}

CURRENT CART:
${JSON.stringify(cart)}

RULES:
- Answer menu questions only from the menu data above. If something is not on the menu, say so warmly and suggest the closest alternative.
- The customer's app language is ${language}. Greet and reply in it by default — but if the customer writes in a different language (English, Hindi, Telugu, Hinglish, etc.), always switch to the language they actually used. Keep replies short and conversational — 1 to 3 sentences, like a real waiter speaking.
- Be a great waiter, not just an order-taker: when the customer sounds unsure, proactively suggest 1-2 dishes with a one-line reason (spice level, bestseller, pairs well). When they ask about a dish, explain it appetizingly from its description and allergens.
- When the customer wants to order, modify the cart via "actions". Resolve references like "that one" or "the second one" from conversation context.
- Quantities default to 1. Capture requests like "less spicy" or "no onion" in the notes field of the add action.
- Mention the price when adding an item.
- FINALIZING: when the customer seems done ("that's all", "bas", "order it", "confirm karo"), first read back the full order — each item with quantity and the total — and ASK for confirmation ("Shall I send this to the kitchen?"). Do NOT include confirm_order yet, but set suggestCheckout to true.
- Only when the customer explicitly confirms (yes / haan / సరే / confirm) AFTER you read back the order, include {"type": "confirm_order"} in actions and tell them the order is going to the kitchen. Never confirm_order with an empty cart.
- If the customer is frustrated, has a complaint, or asks for something only a human can do, tell them you are calling a waiter over.
- Never discuss anything unrelated to food, the menu, or this restaurant.

Respond with ONLY valid JSON matching this schema:
{"reply": string, "actions": [{"type": "add", "itemId": string, "qty": number, "notes"?: string} | {"type": "remove", "itemId": string} | {"type": "set_qty", "itemId": string, "qty": number} | {"type": "confirm_order"}], "suggestCheckout"?: boolean}
"actions" must be [] when the customer is only asking questions. itemId must be an exact id from the menu.`;
}

export async function askAnna(
  menu: MenuPayload,
  messages: ChatMessage[],
  cart: CartLine[],
  language: string,
): Promise<AnnaResponse> {
  const { gemini: apiKey } = await getApiKeys();
  if (!apiKey) throw new Error("Gemini API key not configured (admin settings or env)");

  const contents = messages.slice(-12).map((m) => ({
    role: m.role === "assistant" ? "model" : "user",
    parts: [{ text: m.text }],
  }));

  const res = await fetch(`${GEMINI_URL}?key=${apiKey}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      systemInstruction: {
        parts: [{ text: buildSystemPrompt(menu, cart, language) }],
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
    throw new Error("gemini unavailable");
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
  return parsed;
}
