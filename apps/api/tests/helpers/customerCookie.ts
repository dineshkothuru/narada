import type { FastifyInstance } from "fastify";
import { CUSTOMER_COOKIE, customerCapability } from "../../src/lib/customerCapability.js";

export async function customerCookie(
  app: FastifyInstance,
  slug = "demo-spice-garden",
  tableCode?: string,
): Promise<{ [CUSTOMER_COOKIE]: string }> {
  const res = await app.inject({
    method: "POST",
    url: tableCode
      ? `/api/outlet/${slug}/table/${tableCode}/session`
      : `/api/outlet/${slug}/session`,
    payload: {},
  });
  if (res.statusCode !== 200)
    throw new Error(`customer session bootstrap failed: ${res.statusCode}`);
  const raw = res.headers["set-cookie"];
  const header = Array.isArray(raw) ? raw[0] : raw;
  const value = header?.split(";", 1)[0]?.split("=", 2)[1];
  if (!value) throw new Error("customer session cookie missing");
  return { [CUSTOMER_COOKIE]: value };
}

export function customerCookieForSession(sessionId: string, outletId: string) {
  return { [CUSTOMER_COOKIE]: customerCapability(sessionId, outletId) };
}
