import "server-only";
import type { NextRequest } from "next/server";

// Best-effort in-memory limiter (per serverless instance). Not a hard
// guarantee under fan-out, but stops naive scripted abuse of the public
// endpoints and the paid AI keys. Move to Upstash/Redis for real enforcement.
const buckets = new Map<string, { count: number; resetAt: number }>();

export function rateLimit(
  req: NextRequest,
  key: string,
  max: number,
  windowMs = 60_000,
): boolean {
  const ip =
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    req.headers.get("x-real-ip") ||
    "local";
  const id = `${key}:${ip}`;
  const now = Date.now();
  const bucket = buckets.get(id);
  if (!bucket || bucket.resetAt < now) {
    buckets.set(id, { count: 1, resetAt: now + windowMs });
    return true;
  }
  bucket.count += 1;
  if (buckets.size > 10_000) {
    for (const [k, v] of buckets) if (v.resetAt < now) buckets.delete(k);
  }
  return bucket.count <= max;
}
