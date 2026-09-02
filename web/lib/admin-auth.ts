// Demo-grade staff auth: PIN checked against restaurants.admin_pin; a static
// HMAC (derived from the service key) is set as an httpOnly cookie and checked
// by middleware. Enough to keep the kitchen/admin off casual URLs — replace
// with Supabase Auth for multi-staff/multi-tenant production.
export const ADMIN_COOKIE = "narada_admin";

export async function adminToken(): Promise<string> {
  const secret = process.env.SUPABASE_SERVICE_ROLE_KEY || "narada-dev";
  const data = new TextEncoder().encode(`narada-admin-ok:${secret}`);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}
