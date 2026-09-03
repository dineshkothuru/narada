import { env } from "../env.js";
import type { Repos } from "../repositories/index.js";

// Port of web/lib/keys.ts. AI keys live in outlet settings (admin-editable);
// env vars are the fallback for local dev. Bring-your-own-key is a product
// feature, not a dev convenience — an outlet pays for its own Gemini/Sarvam
// usage and the owner pastes the keys into admin settings.
const cached = new Map<string, { keys: ApiKeys; at: number }>();

export type ApiKeys = { gemini: string; sarvam: string };

export async function getApiKeys(
  repos: Pick<Repos, "outlets">,
  outletId: string,
): Promise<ApiKeys> {
  // every voice/chat turn calls this — cache to avoid a DB round-trip per turn
  const cacheKey = outletId || "__env__";
  const hit = cached.get(cacheKey);
  if (hit && Date.now() - hit.at < 60_000) return hit.keys;
  const envGemini = env.GEMINI_API_KEY;
  const envSarvam = env.SARVAM_API_KEY;
  try {
    const row = outletId ? await repos.outlets.findApiKeys(outletId) : null;
    const keys = {
      gemini: row?.gemini_api_key || envGemini,
      sarvam: row?.sarvam_api_key || envSarvam,
    };
    cached.set(cacheKey, { keys, at: Date.now() });
    return keys;
  } catch {
    return { gemini: envGemini, sarvam: envSarvam };
  }
}

// The admin settings screen rewrites the keys; without this the outlet would
// keep paying with the old key for up to a minute. Tests use it to isolate.
export function clearApiKeyCache(): void {
  cached.clear();
}
