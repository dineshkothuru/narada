import "server-only";
import { getApiKeys } from "./keys";
import type { MenuPayload } from "./types";

const SARVAM = "https://api.sarvam.ai";
const GEMINI_MODELS = ["gemini-2.5-flash-lite", "gemini-2.5-flash"];

export type DictatedLine = { itemId: string; qty: number; name: string };
export type Dictation = {
  transcript: string;
  lines: DictatedLine[];
  /** anything said that matched no dish, so the waiter can see what was missed */
  unmatched: string[];
};

export async function transcribe(audioBase64: string): Promise<string> {
  const { sarvam } = await getApiKeys();
  if (!sarvam) throw new Error("no sarvam key");

  const bytes = Buffer.from(audioBase64, "base64");
  const form = new FormData();
  form.append("file", new Blob([new Uint8Array(bytes)], { type: "audio/wav" }), "a.wav");
  form.append("model", "saarika:v2.5");
  form.append("language_code", "unknown");

  const res = await fetch(`${SARVAM}/speech-to-text`, {
    method: "POST",
    headers: { "api-subscription-key": sarvam },
    body: form,
  });
  if (!res.ok) {
    console.error("sarvam stt", res.status, (await res.text()).slice(0, 200));
    throw new Error("stt failed");
  }
  const stt = (await res.json()) as { transcript?: string };
  return (stt.transcript || "").trim();
}

// A waiter dictating is a much narrower job than a guest in conversation with
// Narada: no questions, no suggestions, no upselling — just turn "two paneer
// tikka and a butter naan" into lines. Keeping the prompt this tight makes it
// fast and hard to get wrong.
export async function dictateToLines(
  transcript: string,
  menu: MenuPayload,
): Promise<Dictation> {
  const dishes = menu.items
    .filter((m) => m.isAvailable)
    .map((m) => ({ id: m.id, name: m.name.en, hi: m.name.hi, te: m.name.te }));

  const prompt = `You turn a waiter's spoken order into menu lines. Nothing else.

MENU (only these ids may be used):
${JSON.stringify(dishes)}

The waiter said: "${transcript}"

Rules:
- Match on meaning, in any of English, Hindi or Telugu, including rough or partial names.
- Default quantity is 1 when none is said.
- If something spoken matches no dish, list the words in "unmatched" — never guess.
- Reply with JSON only: {"lines":[{"itemId":"<id>","qty":<n>}],"unmatched":["..."]}`;

  const { gemini } = await getApiKeys();
  if (!gemini) throw new Error("no gemini key");

  for (const model of GEMINI_MODELS) {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${gemini}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ role: "user", parts: [{ text: prompt }] }],
          generationConfig: { temperature: 0, responseMimeType: "application/json" },
        }),
      },
    );
    if (!res.ok) {
      console.error("dictate", model, res.status);
      continue;
    }
    const data = (await res.json()) as {
      candidates?: { content?: { parts?: { text?: string }[] } }[];
    };
    const raw = data.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
    try {
      const parsed = JSON.parse(raw) as {
        lines?: { itemId?: string; qty?: number }[];
        unmatched?: string[];
      };
      const byId = new Map(menu.items.map((m) => [m.id, m]));
      const lines: DictatedLine[] = [];
      for (const l of parsed.lines ?? []) {
        const item = l.itemId ? byId.get(l.itemId) : undefined;
        // the model may only return ids that are on the menu and available
        if (!item || !item.isAvailable) continue;
        const qty = Math.min(20, Math.max(1, Math.round(Number(l.qty) || 1)));
        lines.push({ itemId: item.id, qty, name: item.name.en });
      }
      return { transcript, lines, unmatched: (parsed.unmatched ?? []).slice(0, 6) };
    } catch {
      continue;
    }
  }
  return { transcript, lines: [], unmatched: [] };
}
