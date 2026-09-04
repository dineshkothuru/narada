import type { MenuPayload, WaiterDictateResponse } from "@narada/shared";
import type { Repos } from "../repositories/index.js";
import { env } from "../env.js";
import { HttpError, notFound } from "../lib/http.js";
import { fetchMenu } from "./menu.js";

const SARVAM = "https://api.sarvam.ai";
const OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions";
const MODEL = "google/gemini-3.1-flash-lite";

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
  const transcript = input.audio
    ? await transcribe(input.audio, env.SARVAM_API_KEY)
    : (input.text ?? "").trim();
  if (!transcript) throw new HttpError(422, "nothing heard");
  return matchLines(transcript, menu, env.OPENROUTER_API_KEY);
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
  openrouterKey: string,
): Promise<WaiterDictateResponse> {
  if (!openrouterKey) throw new HttpError(502, "could not read that back");
  const dishes = menu.items
    .filter((item) => item.isAvailable)
    .map((item) => ({ id: item.id, name: item.name.en, hi: item.name.hi, te: item.name.te }));
  let response: Response;
  try {
    response = await fetch(OPENROUTER_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${openrouterKey}` },
      body: JSON.stringify({
        model: MODEL,
        messages: [
          {
            role: "system",
            content:
              'Turn a waiter\'s spoken order into menu lines. Match only the supplied dishes. Default quantity is 1. Return JSON only: {"lines":[{"itemId":"<id>","qty":1}],"unmatched":[]}',
          },
          { role: "user", content: `MENU:${JSON.stringify(dishes)}\nORDER:${transcript}` },
        ],
        response_format: { type: "json_object" },
        temperature: 0,
        provider: { allow_fallbacks: false, require_parameters: true },
      }),
    });
  } catch {
    throw new HttpError(502, "could not read that back");
  }
  if (!response.ok) throw new HttpError(502, "could not read that back");
  const body = (await response.json()) as { choices?: { message?: { content?: string } }[] };
  try {
    const parsed = JSON.parse(body.choices?.[0]?.message?.content ?? "{}") as {
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
    throw new HttpError(502, "could not read that back");
  }
}
