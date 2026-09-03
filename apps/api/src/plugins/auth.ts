import type { FastifyInstance, FastifyReply } from "fastify";
import fp from "fastify-plugin";
import { createHmac, timingSafeEqual } from "node:crypto";
import { env } from "../env.js";
import { CUSTOMER_ACCOUNT_COOKIE, verifyCustomerAccountToken } from "../lib/customerAuth.js";

export const STAFF_COOKIE = "narada_staff";
export const STAFF_ROLES = ["admin", "kitchen", "waiter", "reception", "cashier"] as const;
export type StaffRole = (typeof STAFF_ROLES)[number];
export const isStaffRole = (v: unknown): v is StaffRole =>
  typeof v === "string" && (STAFF_ROLES as readonly string[]).includes(v);

export type StaffSession = {
  staffId: string;
  outletId: string;
  role: StaffRole;
  expiresAt: number;
  staff: {
    id: string;
    username: string;
    firstName: string;
    lastName: string | null;
    displayName: string;
  };
  outlet: { id: string; name: string; slug: string };
  /** Compatibility shorthand for service call sites. */
  displayName: string;
};

export type CustomerSession = {
  customerId: string;
  expiresAt: number;
  customer: {
    id: string;
    phone: string;
    firstName: string;
    lastName: string | null;
    displayName: string;
  };
};

export const ROLE_ACCESS: Record<string, StaffRole[]> = {
  "/api/admin/me": [...STAFF_ROLES],
  "/api/auth/staff/password": [...STAFF_ROLES],
  "/api/admin": ["admin"],
  "/api/kitchen": ["admin", "kitchen"],
  "/api/waiter": ["admin", "waiter"],
  "/api/floor": ["admin", "waiter", "reception", "cashier"],
  "/api/counter": ["admin", "cashier"],
  "/api/availability": ["admin", "kitchen", "cashier"],
};

export function rolesForPath(pathname: string): StaffRole[] | null {
  let best: { prefix: string; roles: StaffRole[] } | null = null;
  for (const [prefix, roles] of Object.entries(ROLE_ACCESS)) {
    if (
      (pathname === prefix || pathname.startsWith(`${prefix}/`)) &&
      (!best || prefix.length > best.prefix.length)
    ) {
      best = { prefix, roles };
    }
  }
  return best?.roles ?? null;
}
export function canAccess(pathname: string, role: StaffRole | null): boolean {
  const roles = rolesForPath(pathname);
  return roles === null || (role !== null && roles.includes(role));
}

const TOKEN_TTL_MS = 12 * 60 * 60 * 1000;
export const COOKIE_MAX_AGE_S = TOKEN_TTL_MS / 1000;
const signature = (payload: string) =>
  createHmac("sha256", env.SESSION_SECRET).update(`narada-staff:v3:${payload}`).digest("hex");

export function staffToken(
  staffId: string,
  outletId: string,
  role: StaffRole,
  now = Date.now(),
): string {
  const expiresAt = now + TOKEN_TTL_MS;
  const payload = `${staffId}:${outletId}:${role}:${expiresAt}`;
  return `v3.${staffId}.${outletId}.${role}.${expiresAt}.${signature(payload)}`;
}

export async function verifyStaffToken(
  token: string | undefined,
): Promise<Pick<StaffSession, "staffId" | "outletId" | "role" | "expiresAt"> | null> {
  if (!token) return null;
  const [version, staffId, outletId, role, expires, hash, extra] = token.split(".");
  if (version !== "v3" || extra || !staffId || !outletId || !isStaffRole(role)) return null;
  const expiresAt = Number(expires);
  if (!Number.isSafeInteger(expiresAt) || expiresAt <= Date.now()) return null;
  const expected = Buffer.from(signature(`${staffId}:${outletId}:${role}:${expiresAt}`), "hex");
  const actual = Buffer.from(hash ?? "", "hex");
  if (actual.length !== expected.length || !timingSafeEqual(actual, expected)) return null;
  return { staffId, outletId, role, expiresAt };
}

export function setStaffCookie(reply: FastifyReply, token: string): void {
  reply.setCookie(STAFF_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: COOKIE_MAX_AGE_S,
  });
}
export function clearStaffCookie(reply: FastifyReply): void {
  reply.clearCookie(STAFF_COOKIE, { path: "/" });
}

declare module "fastify" {
  interface FastifyRequest {
    staffSession: StaffSession | null;
    staffRole: StaffRole | null;
    customerSession: CustomerSession | null;
  }
}

async function authPlugin(app: FastifyInstance): Promise<void> {
  app.decorateRequest("staffSession", null);
  app.decorateRequest("staffRole", null);
  app.decorateRequest("customerSession", null);
  app.addHook("onRequest", async (request, reply) => {
    const pathname = request.url.split("?")[0];
    if (pathname === "/api/auth/staff/logout") return;
    const claims = await verifyStaffToken(request.cookies[STAFF_COOKIE]);
    if (claims && app.repos) {
      const row = await app.repos.staff.findActiveById(claims.staffId);
      const outlet = await app.repos.outlets.findActiveById(claims.outletId);
      if (
        row &&
        outlet &&
        row.outlet_id === claims.outletId &&
        row.role === claims.role &&
        isStaffRole(row.role) &&
        row.username &&
        row.first_name
      ) {
        const lastName = row.last_name;
        request.staffSession = {
          ...claims,
          role: row.role,
          staff: {
            id: row.id,
            username: row.username,
            firstName: row.first_name,
            lastName,
            displayName: [row.first_name, lastName].filter(Boolean).join(" "),
          },
          outlet: { id: outlet.id, name: outlet.name, slug: outlet.slug },
          displayName: [row.first_name, lastName].filter(Boolean).join(" "),
        };
        request.staffRole = row.role;
      }
    }
    const customerClaims = verifyCustomerAccountToken(request.cookies[CUSTOMER_ACCOUNT_COOKIE]);
    if (customerClaims && app.repos) {
      const customer = await app.repos.customers.findActiveById(customerClaims.customerId);
      if (customer) {
        request.customerSession = {
          customerId: customer.id,
          expiresAt: customerClaims.expiresAt,
          customer: {
            id: customer.id,
            phone: customer.phone,
            firstName: customer.first_name,
            lastName: customer.last_name,
            displayName: [customer.first_name, customer.last_name].filter(Boolean).join(" "),
          },
        };
      }
    }
    const roles = rolesForPath(pathname);
    if (roles === null) return;
    if (request.staffRole && roles.includes(request.staffRole)) return;
    await reply
      .status(request.staffRole ? 403 : 401)
      .send({ error: request.staffRole ? "forbidden for your role" : "unauthorized" });
  });
}

export default fp(authPlugin, { name: "narada-auth", dependencies: ["@fastify/cookie"] });
