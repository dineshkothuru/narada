import { env } from "../env.js";
import type { Repos } from "../repositories/index.js";

// Port of web/lib/keys.ts. AI keys live in outlet settings (admin-editable);
// env vars are the fallback for local dev. Bring-your-own-key is a product
// feature, not a dev convenience — an outlet pays for its own Gemini/Sarvam
// usage and the owner pastes the keys into admin settings.
let cached: { keys: ApiKeys; at: number } | null = null;

export type ApiKeys = { gemini: string; sarvam: string };

export async function getApiKeys(repos: Pick<Repos, "outlets">): Promise<ApiKeys> {
  // every voice/chat turn calls this — cache to avoid a DB round-trip per turn
  if (cached && Date.now() - cached.at < 60_000) return cached.keys;
  const envGemini = env.GEMINI_API_KEY;
  const envSarvam = env.SARVAM_API_KEY;
  try {
    const row = await repos.outlets.findApiKeys();
    const keys = {
      gemini: row?.gemini_api_key || envGemini,
      sarvam: row?.sarvam_api_key || envSarvam,
    };
    cached = { keys, at: Date.now() };
    return keys;
  } catch {
    return { gemini: envGemini, sarvam: envSarvam };
  }
}

// The admin settings screen rewrites the keys; without this the outlet would
// keep paying with the old key for up to a minute. Tests use it to isolate.
export function clearApiKeyCache(): void {
  cached = null;
}
