import { createHmac, timingSafeEqual } from "node:crypto";
import type { FastifyReply } from "fastify";
import { env } from "../env.js";

export const CUSTOMER_COOKIE = "narada_customer_session";
const TTL_MS = 12 * 60 * 60 * 1000;
export const CUSTOMER_COOKIE_MAX_AGE_S = TTL_MS / 1000;

const sign = (payload: string) =>
  createHmac("sha256", env.SESSION_SECRET).update(`narada-customer:v1:${payload}`).digest("hex");

export function customerCapability(sessionId: string, outletId: string, now = Date.now()): string {
  const expiresAt = now + TTL_MS;
  const payload = `${sessionId}:${outletId}:${expiresAt}`;
  return `v1.${sessionId}.${outletId}.${expiresAt}.${sign(payload)}`;
}

export function verifyCustomerCapability(
  token: string | undefined,
  now = Date.now(),
): { sessionId: string; outletId: string; expiresAt: number } | null {
  if (!token) return null;
  const [version, sessionId, outletId, expires, hash, extra] = token.split(".");
  if (version !== "v1" || extra || !sessionId || !outletId || !hash) return null;
  const expiresAt = Number(expires);
  if (!Number.isSafeInteger(expiresAt) || expiresAt <= now) return null;
  const expected = Buffer.from(sign(`${sessionId}:${outletId}:${expiresAt}`), "hex");
  const actual = Buffer.from(hash, "hex");
  if (actual.length !== expected.length || !timingSafeEqual(actual, expected)) return null;
  return { sessionId, outletId, expiresAt };
}

export function setCustomerCookie(reply: FastifyReply, token: string): void {
  reply.setCookie(CUSTOMER_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: CUSTOMER_COOKIE_MAX_AGE_S,
  });
}
