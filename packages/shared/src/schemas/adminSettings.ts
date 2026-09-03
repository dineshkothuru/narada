import { z } from "zod";

export const outletSlugSchema = z
  .string()
  .trim()
  .toLowerCase()
  .min(3, "outlet slug must be at least 3 characters")
  .max(63, "outlet slug must be at most 63 characters")
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "outlet slug may use letters, numbers, and single hyphens");

// PATCH /api/admin/settings
export const patchSettingsSchema = z.object({
  // Accepted for old clients during the transition, but protected routes must
  // use the authenticated session outlet instead of trusting this value.
  outletId: z.string().min(1, "outletId required").optional(),
  slug: outletSlugSchema.optional(),
  payment_timing: z.enum(["pre", "post"]).optional(),
  upi_vpa: z.string().optional(),
  gemini_api_key: z.string().optional(),
  sarvam_api_key: z.string().optional(),
  comp_item_id: z.string().nullable().optional(),
  service_charge_pct: z.number().optional(),
  gstin: z.string().optional(),
});
export type PatchSettingsInput = z.infer<typeof patchSettingsSchema>;

export type PatchSettingsResponse = { ok: true };
