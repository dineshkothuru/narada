import "server-only";
import { sbFetch } from "./supabase-server";

// AI keys live in restaurant settings (admin-editable); env vars are the
// fallback for local dev. Read via service role only — anon column grants
// exclude these fields.
export async function getApiKeys(): Promise<{ gemini: string; sarvam: string }> {
  const envGemini = process.env.GEMINI_API_KEY || "";
  const envSarvam = process.env.SARVAM_API_KEY || "";
  try {
    const rows = await sbFetch<
      { gemini_api_key: string | null; sarvam_api_key: string | null }[]
    >(`restaurants?select=gemini_api_key,sarvam_api_key&limit=1`);
    return {
      gemini: rows[0]?.gemini_api_key || envGemini,
      sarvam: rows[0]?.sarvam_api_key || envSarvam,
    };
  } catch {
    return { gemini: envGemini, sarvam: envSarvam };
  }
}
