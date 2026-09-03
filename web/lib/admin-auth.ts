// Staff auth: PIN → role (admin/kitchen/waiter) from the staff table (the
// outlet owner's admin_pin acts as the built-in admin). The cookie carries
// "role.hmac" — middleware recomputes the HMAC and gates paths by role.
// Replace with Supabase Auth when multi-tenant hosting arrives.
import { env } from "./env";

export const ADMIN_COOKIE = "narada_admin";

// one list, so adding a role can't leave verifyToken silently rejecting it
export const STAFF_ROLES = ["admin", "kitchen", "waiter", "reception", "cashier"] as const;
export type StaffRole = (typeof STAFF_ROLES)[number];

export const isStaffRole = (v: unknown): v is StaffRole =>
  typeof v === "string" && (STAFF_ROLES as readonly string[]).includes(v);

// api/admin/me is the "who am I" probe — any signed-in role may call it
export const ROLE_ACCESS: Record<string, StaffRole[]> = {
  "/api/admin/me": ["admin", "kitchen", "waiter", "reception", "cashier"],
  "/admin": ["admin"],
  "/api/admin": ["admin"],
  "/kitchen": ["admin", "kitchen"],
  "/api/kitchen": ["admin", "kitchen"],
  "/waiter": ["admin", "waiter"],
  "/api/waiter": ["admin", "waiter"],
  "/floor": ["admin", "waiter", "reception", "cashier"],
  "/api/floor": ["admin", "waiter", "reception", "cashier"],
  // taking money is the counter's job, not the waiter's
  "/counter": ["admin", "cashier"],
  "/api/counter": ["admin", "cashier"],
};

// Longest match wins, and matching is segment-aware so "/admin" never claims
// "/administrator". Picking the longest prefix means /api/admin/me keeps its
// own wider rule no matter where it sits in the table above — the previous
// first-match-wins scan silently depended on key order.
export function rolesForPath(pathname: string): StaffRole[] | null {
  let best: { prefix: string; roles: StaffRole[] } | null = null;
  for (const [prefix, roles] of Object.entries(ROLE_ACCESS)) {
    const matches = pathname === prefix || pathname.startsWith(`${prefix}/`);
    if (matches && (!best || prefix.length > best.prefix.length)) {
      best = { prefix, roles };
    }
  }
  return best ? best.roles : null;
}

export function canAccess(pathname: string, role: StaffRole | null): boolean {
  if (role === null) return false;
  const roles = rolesForPath(pathname);
  return roles === null || roles.includes(role);
}

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
  if (!isStaffRole(role)) return null;
  const exp = Number(expStr);
  if (!Number.isFinite(exp) || exp < Date.now()) return null;
  return hash === (await hmac(`${role}:${exp}`)) ? role : null;
}
