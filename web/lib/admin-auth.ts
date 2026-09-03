// Staff auth: PIN → role (admin/kitchen/waiter) from the staff table (the
// restaurant owner's admin_pin acts as the built-in admin). The cookie carries
// "role.hmac" — middleware recomputes the HMAC and gates paths by role.
// Replace with Supabase Auth when multi-tenant hosting arrives.
import { env } from "./env";

export const ADMIN_COOKIE = "narada_admin";

export type StaffRole = "admin" | "kitchen" | "waiter" | "reception";

export const ROLE_ACCESS: Record<string, StaffRole[]> = {
  "/admin": ["admin"],
  "/api/admin": ["admin"],
  "/kitchen": ["admin", "kitchen"],
  "/api/kitchen": ["admin", "kitchen"],
  "/waiter": ["admin", "waiter"],
  "/api/waiter": ["admin", "waiter"],
  "/floor": ["admin", "waiter", "reception"],
  "/api/floor": ["admin", "waiter", "reception"],
};

const TOKEN_TTL_MS = 12 * 60 * 60 * 1000;

async function hmac(payload: string): Promise<string> {
  const secret = env.SESSION_SECRET;
  const data = new TextEncoder().encode(`narada-staff:${payload}:${secret}`);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

// token = role.expiryMs.hmac(role:expiry) — self-expiring server-side, so a
// saved cookie stops working after 12h regardless of client cookie settings
export async function roleToken(role: StaffRole): Promise<string> {
  const exp = Date.now() + TOKEN_TTL_MS;
  return `${role}.${exp}.${await hmac(`${role}:${exp}`)}`;
}

export async function verifyToken(token: string | undefined): Promise<StaffRole | null> {
  if (!token) return null;
  const [role, expStr, hash] = token.split(".");
  if (role !== "admin" && role !== "kitchen" && role !== "waiter" && role !== "reception") {
    return null;
  }
  const exp = Number(expStr);
  if (!Number.isFinite(exp) || exp < Date.now()) return null;
  return hash === (await hmac(`${role}:${exp}`)) ? role : null;
}
