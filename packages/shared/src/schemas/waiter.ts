import { z } from "zod";

// Port of the PATCH body shape web/app/api/waiter/route.ts parsed by hand.
// One `action` discriminates four otherwise-unrelated mutations; each field
// below is required only by the action that uses it, exactly as the legacy
// handler checked them one `if` at a time rather than as a discriminated
// union — so a body missing the field for its action still parses here and
// gets the same "invalid action" 400 the legacy handler gave it.

export const waiterPaymentMethods = ["upi_intent", "cash", "card"] as const;

export const waiterPatchSchema = z.object({
  action: z.enum(["ack_call", "mark_served", "clear_table", "record_payment"]),
  amount: z.number().optional(),
  method: z.enum(waiterPaymentMethods).optional(),
  utr: z.string().optional(),
  collectedBy: z.string().optional(),
  orderId: z.string().optional(),
  tableId: z.string().optional(),
  callId: z.string().optional(),
  attendedBy: z.string().optional(),
  sessionId: z.string().optional(),
});

export type WaiterPatchInput = z.infer<typeof waiterPatchSchema>;
