import { createHmac, timingSafeEqual } from "node:crypto";
import type { FastifyReply } from "fastify";
import { env } from "../env.js";

export const CUSTOMER_ACCOUNT_COOKIE = "narada_customer";
const TTL_MS = 12 * 60 * 60 * 1000;
export const CUSTOMER_ACCOUNT_COOKIE_MAX_AGE_S = TTL_MS / 1000;

const sign = (payload: string) =>
  createHmac("sha256", env.SESSION_SECRET)
    .update(`narada-customer-account:v1:${payload}`)
    .digest("hex");

export function customerAccountToken(customerId: string, now = Date.now()): string {
  const expiresAt = now + TTL_MS;
  return `v1.${customerId}.${expiresAt}.${sign(`${customerId}:${expiresAt}`)}`;
}

export function verifyCustomerAccountToken(
  token: string | undefined,
  now = Date.now(),
): { customerId: string; expiresAt: number } | null {
  if (!token) return null;
  const [version, customerId, expires, hash, extra] = token.split(".");
  if (version !== "v1" || extra || !customerId || !expires || !hash) return null;
  const expiresAt = Number(expires);
  if (!Number.isSafeInteger(expiresAt) || expiresAt <= now) return null;
  const expected = Buffer.from(sign(`${customerId}:${expiresAt}`), "hex");
  const actual = Buffer.from(hash, "hex");
  if (actual.length !== expected.length || !timingSafeEqual(actual, expected)) return null;
  return { customerId, expiresAt };
}

export function setCustomerAccountCookie(reply: FastifyReply, token: string): void {
  reply.setCookie(CUSTOMER_ACCOUNT_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: CUSTOMER_ACCOUNT_COOKIE_MAX_AGE_S,
  });
}

export function clearCustomerAccountCookie(reply: FastifyReply): void {
  reply.clearCookie(CUSTOMER_ACCOUNT_COOKIE, { path: "/" });
}
