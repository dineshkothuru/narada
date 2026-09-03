// Staff auth: PIN → role (admin/kitchen/waiter) from the staff table (the
// restaurant owner's admin_pin acts as the built-in admin). The cookie carries
// "role.hmac" — middleware recomputes the HMAC and gates paths by role.
// Replace with Supabase Auth when multi-tenant hosting arrives.
export const ADMIN_COOKIE = "narada_admin";

export type StaffRole = "admin" | "kitchen" | "waiter";

export const ROLE_ACCESS: Record<string, StaffRole[]> = {
  "/admin": ["admin"],
  "/api/admin": ["admin"],
  "/kitchen": ["admin", "kitchen"],
  "/api/kitchen": ["admin", "kitchen"],
  "/waiter": ["admin", "waiter"],
  "/api/waiter": ["admin", "waiter"],
};

async function hmac(role: string): Promise<string> {
  const secret = process.env.SUPABASE_SERVICE_ROLE_KEY || "narada-dev";
  const data = new TextEncoder().encode(`narada-staff:${role}:${secret}`);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export async function roleToken(role: StaffRole): Promise<string> {
  return `${role}.${await hmac(role)}`;
}

export async function verifyToken(token: string | undefined): Promise<StaffRole | null> {
  if (!token) return null;
  const [role, hash] = token.split(".");
  if (role !== "admin" && role !== "kitchen" && role !== "waiter") return null;
  return hash === (await hmac(role)) ? role : null;
}
