import { z } from "zod";

// Port of the PATCH body shape web/app/api/kitchen/route.ts parsed by hand.
// Two mutually exclusive branches: a per-dish update (itemId + itemStatus)
// or a whole-ticket advance (orderId + status).

export const kitchenItemStatuses = ["queued", "preparing", "ready", "served"] as const;
export const kitchenOrderStatuses = ["preparing", "ready", "served", "cancelled"] as const;

export const kitchenPatchSchema = z.object({
  orderId: z.string().optional(),
  status: z.enum(kitchenOrderStatuses).optional(),
  itemId: z.string().optional(),
  itemStatus: z.enum(kitchenItemStatuses).optional(),
});

export type KitchenPatchInput = z.infer<typeof kitchenPatchSchema>;
