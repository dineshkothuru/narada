import type { FastifyRequest } from "fastify";

// Per-route limits for @fastify/rate-limit, which is registered globally
// disabled in app.ts — a route opts in by spreading rateLimited() into its
// options. Replaces the hand-rolled bucket map in web/lib/ratelimit.ts.
//
//   app.post("/api/order", { ...rateLimited(15) }, handler)
export function rateLimited(max: number, windowMs = 60_000) {
  return { config: { rateLimit: { max, timeWindow: windowMs } } };
}

// Same key as web/lib/ratelimit.ts: first hop of x-forwarded-for, then
// x-real-ip, then the socket. Behind a proxy every request otherwise shares
// the proxy's address and one noisy table would throttle the whole floor.
export function clientIp(request: FastifyRequest): string {
  const forwarded = request.headers["x-forwarded-for"];
  const first = Array.isArray(forwarded) ? forwarded[0] : forwarded;
  const fromForwarded = first?.split(",")[0]?.trim();
  if (fromForwarded) return fromForwarded;
  const real = request.headers["x-real-ip"];
  const realIp = Array.isArray(real) ? real[0] : real;
  return realIp || request.ip || "local";
}
