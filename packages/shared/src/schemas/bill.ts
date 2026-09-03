import { z } from "zod";

// GET /api/bill?session=<id>&tip=<n> — customer-facing bill preview.
export const billQuerySchema = z.object({
  session: z.string().min(1, "session required"),
  tableCode: z.string().min(1).optional(),
  tip: z.string().optional(),
});
export type BillQuery = z.infer<typeof billQuerySchema>;

// PATCH /api/bill — waive service charge and/or set a tip. At least one of
// serviceWaived/tip must be present (checked in the route, matching the
// legacy "nothing to update" 400). serviceWaived/tip stay `unknown` — legacy
// never validated their shape at the boundary, just silently dropped a
// wrong-typed value via `typeof` checks, and the route here does the same;
// rejecting the whole request with a 400 for e.g. `tip: "10"` would be a
// stricter, non-parity behaviour.
export const patchBillSchema = z.object({
  tableCode: z.string().min(1).optional(),
  sessionId: z.string().min(1),
  serviceWaived: z.unknown().optional(),
  tip: z.unknown().optional(),
});
export type PatchBillInput = {
  tableCode?: string;
  sessionId: string;
  serviceWaived?: unknown;
  tip?: unknown;
};
