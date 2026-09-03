import { z } from "zod";

// PATCH /api/admin/settings
export const patchSettingsSchema = z.object({
  outletId: z.string().min(1, "outletId required"),
  payment_timing: z.enum(["pre", "post"]).optional(),
  upi_vpa: z.string().optional(),
  admin_pin: z.string().optional(),
  gemini_api_key: z.string().optional(),
  sarvam_api_key: z.string().optional(),
  comp_item_id: z.string().nullable().optional(),
  service_charge_pct: z.number().optional(),
  gstin: z.string().optional(),
});
export type PatchSettingsInput = z.infer<typeof patchSettingsSchema>;

export type PatchSettingsResponse = { ok: true };
