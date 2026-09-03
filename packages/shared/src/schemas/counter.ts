import { z } from "zod";

// Port of the PATCH body shape web/app/api/counter/route.ts parsed by hand
// (main's post-rename version — outlets/outlet_id naming, no "restaurant").
// One `action` discriminates three billing-desk mutations.

export const counterPaymentMethods = ["upi_intent", "cash", "card"] as const;

export const counterPatchSchema = z.object({
  action: z.enum(["generate_bill", "record_payment", "waive_service"]),
  sessionId: z.string().optional(),
  tip: z.number().optional(),
  amount: z.number().optional(),
  method: z.enum(counterPaymentMethods).optional(),
  utr: z.string().optional(),
  waived: z.boolean().optional(),
});

export type CounterPatchInput = z.infer<typeof counterPatchSchema>;
