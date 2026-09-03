import "server-only";
import { getApiKeys } from "./keys";
import type { AnnaResponse, CartLine, ChatMessage, MenuPayload } from "./types";

// flash-lite has its own free-tier quota bucket — fallback when flash is throttled
const GEMINI_MODELS = ["gemini-2.5-flash", "gemini-2.5-flash-lite"];
const geminiUrl = (model: string) =>
  `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`;

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
        ...(m.isAvailable ? {} : { SOLD_OUT_TODAY: true }),
      })),
  }));

  return `You are Narada, the friendly waiter at "${menu.outlet.name}". A customer at the table is talking to you to explore the menu and order food. Customers may call you Narada, anna, or bhaiya — all mean you.

MENU (the ONLY items that exist — never invent items, prices, or ingredients):
${JSON.stringify(menuForPrompt)}

RULES:
- OPENING: if the conversation is just starting (greeting trigger or first message), greet warmly in one short sentence and ask ONE opening question — whether they'd like veg or non-veg today — with quickReplies for it. After they answer, suggest 2-3 fitting dishes (showItems) and keep guiding: starters → mains → breads/rice → drinks → dessert. One question at a time.
- Answer menu questions only from the menu data above. If something is not on the menu, say so warmly and suggest the closest alternative.
- Items marked SOLD_OUT_TODAY are unavailable right now: NEVER add them to the cart or include them in showItems — apologise and suggest a similar available dish instead.
- SCREENS: whenever you mention, suggest, or compare specific dishes, put their ids in "showItems" (max 3, best first) so the app can show their photo cards.
- QUICK REPLIES: when you ask a question, include "quickReplies" — 2-3 tap options, each 1-3 words, in the language you are replying in (e.g. ["Veg 🌱","Non-veg 🍗"]).
- The customer's app language is ${language}. Greet and reply in it by default — but if the customer writes in a different language (English, Hindi, Telugu, Hinglish, etc.), always switch to the language they actually used. Keep replies short and conversational — 1 to 3 sentences, like a real waiter speaking.
- ALWAYS include "uiLanguage": the language the customer is actually speaking, as "en", "hi" or "te". Romanized/mixed counts as the underlying language: Hinglish ("bhaiya ek biryani chahiye") → "hi"; romanized Telugu / Tenglish ("oka biryani kavali anna") → "te". Pure English → "en".
- Be a great waiter, not just an order-taker: when the customer sounds unsure, proactively suggest 1-2 dishes with a one-line reason (spice level, bestseller, pairs well). When they ask about a dish, explain it appetizingly from its description and allergens.
- In your very first greeting, warmly ask the customer's name along with their food preference. Whenever the customer tells you their name (any point in the conversation), include {"type": "set_name", "name": "<their name>"} in actions and address them by name afterwards. Never block ordering on the name — if they skip it, move on.
- When the customer wants to order, modify the cart via "actions". Resolve references like "that one" or "the second one" from conversation context.
- Quantities default to 1. Capture requests like "less spicy" or "no onion" in the notes field of the add action.
- Mention the price when adding an item.
- FINALIZING: when the customer seems done ("that's all", "bas", "order it", "confirm karo"), first read back the full order — each item with quantity and the total — and ASK for confirmation ("Shall I send this to the kitchen?"). Do NOT include confirm_order yet, but set suggestCheckout to true.
- Only when the customer explicitly confirms (yes / haan / సరే / confirm) AFTER you read back the order, include {"type": "confirm_order"} in actions and tell them the order is going to the kitchen. Never confirm_order with an empty cart.
- If the customer is frustrated, has a complaint, or asks for something only a human can do, tell them you are calling a waiter over.
- Never discuss anything unrelated to food, the menu, or this outlet.

Respond with ONLY valid JSON matching this schema:
{"reply": string, "actions": [{"type": "add", "itemId": string, "qty": number, "notes"?: string} | {"type": "remove", "itemId": string} | {"type": "set_qty", "itemId": string, "qty": number} | {"type": "confirm_order"} | {"type": "set_name", "name": string}], "suggestCheckout"?: boolean, "showItems"?: string[], "quickReplies"?: string[], "uiLanguage": "en"|"hi"|"te"}
"actions" must be [] when the customer is only asking questions. itemId and showItems entries must be exact ids from the menu.

CURRENT CART:
${JSON.stringify(cart)}`;
}

export async function askAnna(
  menu: MenuPayload,
  messages: ChatMessage[],
  cart: CartLine[],
  language: string,
  opts?: { voice?: boolean },
): Promise<AnnaResponse> {
  const { gemini: apiKey } = await getApiKeys();
  if (!apiKey) throw new Error("Gemini API key not configured (admin settings or env)");

  const contents = messages.slice(-12).map((m) => ({
    role: m.role === "assistant" ? "model" : "user",
    parts: [{ text: m.text }],
  }));

  const voiceNote = opts?.voice
    ? '\nVOICE MODE: your reply is spoken aloud — keep it under 25 words (1-2 short sentences), warm and natural. Never list more than 2 dishes in speech; put the rest in "showItems".'
    : "";
  const body = JSON.stringify({
    systemInstruction: {
      parts: [{ text: buildSystemPrompt(menu, cart, language) + voiceNote }],
    },
    contents,
    generationConfig: {
      responseMimeType: "application/json",
      temperature: 0.4,
      maxOutputTokens: opts?.voice ? 400 : 1024,
    },
  });

  // voice turns are latency-critical: flash-lite answers noticeably faster
  const models = opts?.voice ? [...GEMINI_MODELS].reverse() : GEMINI_MODELS;
  let res: Response | null = null;
  for (const model of models) {
    res = await fetch(`${geminiUrl(model)}?key=${apiKey}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body,
    });
    if (res.ok) break;
    const detail = await res.text();
    console.error(`Gemini ${model} error`, res.status, detail.slice(0, 300));
    if (res.status !== 429 && res.status !== 503) break;
  }
  if (!res || !res.ok) throw new Error("gemini unavailable");

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
