import "server-only";

const REQUIRED = ["SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY", "SESSION_SECRET"] as const;
const OPTIONAL = ["SUPABASE_ANON_KEY", "GEMINI_API_KEY", "SARVAM_API_KEY"] as const;

type RequiredKey = (typeof REQUIRED)[number];
type OptionalKey = (typeof OPTIONAL)[number];

const missing = REQUIRED.filter((key) => !process.env[key]);
if (missing.length > 0) {
  throw new Error(`Missing env: ${missing.join(", ")}`);
}

export const env = {
  ...Object.fromEntries(REQUIRED.map((key) => [key, process.env[key] as string])),
  ...Object.fromEntries(OPTIONAL.map((key) => [key, process.env[key] ?? ""])),
} as Record<RequiredKey, string> & Record<OptionalKey, string>;
