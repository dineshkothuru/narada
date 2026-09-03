import { z } from "zod";

export const availabilityQuerySchema = z.object({});
export const availabilityPatchSchema = z.object({
  menuItemId: z.string().uuid("menuItemId required"),
  available: z.boolean(),
});
export type AvailabilityPatchInput = z.infer<typeof availabilityPatchSchema>;

export type AvailabilityDish = { id: string; name: string; is_available: boolean };
export type AvailabilityEvent = {
  action: "dish_sold_out" | "dish_back_on";
  role: string | null;
  actor_name: string | null;
  details: Record<string, unknown> | null;
  created_at: string;
};
export type AvailabilityResponse = { menu: AvailabilityDish[]; recent: AvailabilityEvent[] };
