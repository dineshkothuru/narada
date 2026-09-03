import { normalizeIP } from "@fastify/rate-limit";
import type { FastifyRequest } from "fastify";

// Per-route limits for @fastify/rate-limit, which is registered globally
// disabled in app.ts — a route opts in by spreading rateLimited() into its
// options. Replaces the hand-rolled bucket map in web/lib/ratelimit.ts.
//
//   app.post("/api/order", { ...rateLimited(15) }, handler)
export function rateLimited(max: number, windowMs = 60_000) {
  return { config: { rateLimit: { max, timeWindow: windowMs } } };
}

// Railway contributes one trusted proxy hop. Fastify resolves request.ip from
// that hop; normalizeIP also prevents IPv6 spelling/rotation bypasses.
export function clientIp(request: FastifyRequest): string {
  return normalizeIP(request.ip || "local", 64);
}
