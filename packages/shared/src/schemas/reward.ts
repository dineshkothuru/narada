import { z } from "zod";

// POST /api/reward — pre-order wheel spin, or post-order comp claim. Every
// failure here (missing tableCode, missing type, invalid type value) maps to
// one legacy message; the route sends that fixed string rather than any
// particular zod issue, so per-field messages here don't need to match it.
export const rewardSchema = z.object({
  tableCode: z.string().min(1),
  type: z.enum(["spin", "comp"]),
});
export type RewardInput = z.infer<typeof rewardSchema>;

export type SpinResult = { ok: boolean; discountPct: number; sliceIndex: number };
export type CompResult =
  { ok: true; item: string } | { ok: false; reason: "no orders yet" | "already awarded" };
