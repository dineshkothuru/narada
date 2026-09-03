import type { MenuPayload, WaiterDictateResponse } from "@narada/shared";
import type { Repos } from "../repositories/index.js";
import { HttpError, notFound } from "../lib/http.js";
import { getApiKeys } from "./keys.js";
import { fetchMenu } from "./menu.js";

const SARVAM = "https://api.sarvam.ai";
const GEMINI_MODELS = ["gemini-2.5-flash-lite", "gemini-2.5-flash"];

type DictateRepos = Pick<Repos, "tables" | "outlets" | "menuCategories" | "menuItems">;

export async function dictateOrder(
  repos: DictateRepos,
  input: { tableCode: string; audio?: string; text?: string },
  outletId: string,
): Promise<WaiterDictateResponse> {
  const table = await repos.tables.findByCodeForOutlet(input.tableCode, outletId);
  if (!table) throw notFound("unknown table");
  const menu = await fetchMenu(repos, input.tableCode);
  if (!menu) throw notFound("unknown table");
  const keys = await getApiKeys(repos, outletId);
  const transcript = input.audio
    ? await transcribe(input.audio, keys.sarvam)
    : (input.text ?? "").trim();
  if (!transcript) throw new HttpError(422, "nothing heard");
  return matchLines(transcript, menu, keys.gemini);
}

async function transcribe(audio: string, key: string): Promise<string> {
  if (!key) throw new HttpError(502, "could not read that back");
  const bytes = Buffer.from(audio, "base64");
  const form = new FormData();
  form.append("file", new Blob([new Uint8Array(bytes)], { type: "audio/wav" }), "a.wav");
  form.append("model", "saarika:v2.5");
  form.append("language_code", "unknown");
  let response: Response;
  try {
    response = await fetch(`${SARVAM}/speech-to-text`, {
      method: "POST",
      headers: { "api-subscription-key": key },
      body: form,
    });
  } catch {
    throw new HttpError(502, "could not read that back");
  }
  if (!response.ok) throw new HttpError(502, "could not read that back");
  const body = (await response.json()) as { transcript?: string };
  return (body.transcript ?? "").trim();
}

async function matchLines(
  transcript: string,
  menu: MenuPayload,
  geminiKey: string,
): Promise<WaiterDictateResponse> {
  if (!geminiKey) throw new HttpError(502, "could not read that back");
  const dishes = menu.items
    .filter((item) => item.isAvailable)
    .map((item) => ({ id: item.id, name: item.name.en, hi: item.name.hi, te: item.name.te }));
  const prompt = `Turn a waiter's spoken order into menu lines. Match only these dishes. Default quantity is 1. Return JSON only: {"lines":[{"itemId":"<id>","qty":1}],"unmatched":[]}\nMENU:${JSON.stringify(dishes)}\nORDER:${transcript}`;
  for (const model of GEMINI_MODELS) {
    let response: Response;
    try {
      response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${geminiKey}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            contents: [{ role: "user", parts: [{ text: prompt }] }],
            generationConfig: { temperature: 0, responseMimeType: "application/json" },
          }),
        },
      );
    } catch {
      continue;
    }
    if (!response.ok) continue;
    const body = (await response.json()) as {
      candidates?: { content?: { parts?: { text?: string }[] } }[];
    };
    try {
      const parsed = JSON.parse(body.candidates?.[0]?.content?.parts?.[0]?.text ?? "{}") as {
        lines?: { itemId?: string; qty?: number }[];
        unmatched?: string[];
      };
      const byId = new Map(menu.items.map((item) => [item.id, item]));
      const lines = (parsed.lines ?? []).flatMap((line) => {
        const item = line.itemId ? byId.get(line.itemId) : undefined;
        if (!item || !item.isAvailable) return [];
        return [
          {
            itemId: item.id,
            qty: Math.min(20, Math.max(1, Math.round(Number(line.qty) || 1))),
            name: item.name.en,
          },
        ];
      });
      return { transcript, lines, unmatched: (parsed.unmatched ?? []).slice(0, 6) };
    } catch {
      // Try the fallback model before reporting a provider failure.
    }
  }
  throw new HttpError(502, "could not read that back");
}
