import "server-only";
import { sbFetch } from "./supabase-server";

// AI keys live in restaurant settings (admin-editable); env vars are the
// fallback for local dev. Read via service role only — anon column grants
// exclude these fields.
let cached: { keys: { gemini: string; sarvam: string }; at: number } | null = null;

export async function getApiKeys(): Promise<{ gemini: string; sarvam: string }> {
  // every voice/chat turn calls this — cache to avoid a DB round-trip per turn
  if (cached && Date.now() - cached.at < 60_000) return cached.keys;
  const envGemini = process.env.GEMINI_API_KEY || "";
  const envSarvam = process.env.SARVAM_API_KEY || "";
  try {
    const rows = await sbFetch<{ gemini_api_key: string | null; sarvam_api_key: string | null }[]>(
      `restaurants?select=gemini_api_key,sarvam_api_key&limit=1`,
    );
    const keys = {
      gemini: rows[0]?.gemini_api_key || envGemini,
      sarvam: rows[0]?.sarvam_api_key || envSarvam,
    };
    cached = { keys, at: Date.now() };
    return keys;
  } catch {
    return { gemini: envGemini, sarvam: envSarvam };
  }
}
