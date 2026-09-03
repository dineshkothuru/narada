import type { FastifyInstance, FastifyReply } from "fastify";
import fp from "fastify-plugin";
import { env } from "../env.js";

// Literal port of web/lib/admin-auth.ts + web/middleware.ts. The cookie format
// and the digest are unchanged on purpose: a staff member logged into the Next
// app keeps their session across the cutover.

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
// own wider rule no matter where it sits in the table above.
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
export const COOKIE_MAX_AGE_S = 60 * 60 * 12;

// Deliberately the Web Crypto SHA-256 digest of the same string the Next app
// hashed, not an HMAC — swapping in createHmac would invalidate every cookie
// currently in a staff member's browser. crypto.subtle is global in Node 22.
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

// Mirrors the cookie options in web/app/api/admin/login/route.ts.
export function setRoleCookie(reply: FastifyReply, token: string): void {
  reply.setCookie(ADMIN_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: COOKIE_MAX_AGE_S,
  });
}

export function clearRoleCookie(reply: FastifyReply): void {
  reply.clearCookie(ADMIN_COOKIE, { path: "/" });
}

declare module "fastify" {
  interface FastifyRequest {
    staffRole: StaffRole | null;
  }
}

// Only /api/* is gated here. The page paths in ROLE_ACCESS belong to the SPA,
// which does its own redirect to /admin/login; the API answers with JSON.
async function authPlugin(app: FastifyInstance): Promise<void> {
  app.decorateRequest("staffRole", null);

  app.addHook("onRequest", async (request, reply) => {
    const pathname = request.url.split("?")[0];
    if (pathname === "/api/admin/login") return;

    const role = await verifyToken(request.cookies[ADMIN_COOKIE]);
    request.staffRole = role;

    if (!pathname.startsWith("/api/")) return;
    if (rolesForPath(pathname) === null) return; // ungated public endpoint
    if (canAccess(pathname, role)) return;

    await reply
      .status(role ? 403 : 401)
      .send({ error: role ? "forbidden for your role" : "unauthorized" });
  });
}

export default fp(authPlugin, { name: "narada-auth", dependencies: ["@fastify/cookie"] });
