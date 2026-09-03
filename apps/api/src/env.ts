const REQUIRED = ["DATABASE_URL", "SESSION_SECRET"] as const;
// SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY are optional and used only for
// Supabase Storage (dish photos). Everything else reads Postgres directly.
const OPTIONAL = [
  "GEMINI_API_KEY",
  "SARVAM_API_KEY",
  "PORT",
  "WEB_DIST",
  "REDIS_URL",
  "TRUST_PROXY_HOPS",
  "SUPABASE_URL",
  "SUPABASE_SERVICE_ROLE_KEY",
  "ADMIN_BOOTSTRAP_USERNAME",
  "ADMIN_BOOTSTRAP_FIRST_NAME",
  "ADMIN_BOOTSTRAP_LAST_NAME",
  "ADMIN_BOOTSTRAP_PASSWORD",
  "ADMIN_BOOTSTRAP_OUTLET_SLUG",
] as const;

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

const trustProxyHops = env.TRUST_PROXY_HOPS;
if (trustProxyHops && !/^\d+$/.test(trustProxyHops)) {
  throw new Error("TRUST_PROXY_HOPS must be a non-negative integer");
}
export const trustedProxyHops = Number(trustProxyHops || 0);
