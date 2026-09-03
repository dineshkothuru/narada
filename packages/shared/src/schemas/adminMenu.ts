import { z } from "zod";

// POST /api/admin/menu — create a dish.
export const createMenuItemSchema = z.object({
  category_id: z.string().min(1, "category_id, name and positive price_inr required"),
  name: z.string().min(1, "category_id, name and positive price_inr required"),
  price_inr: z.number().positive("category_id, name and positive price_inr required"),
  description: z.string().optional(),
  is_veg: z.boolean().optional(),
  spice_level: z.number().optional(),
  emoji: z.string().optional(),
});
export type CreateMenuItemInput = z.infer<typeof createMenuItemSchema>;

// DELETE /api/admin/menu?itemId=<id>
export const deleteMenuItemQuerySchema = z.object({
  itemId: z.string().min(1, "itemId required"),
});
export type DeleteMenuItemQuery = z.infer<typeof deleteMenuItemQuerySchema>;

// PATCH /api/admin/menu
export const patchMenuItemSchema = z.object({
  itemId: z.string().min(1, "itemId required"),
  is_available: z.boolean().optional(),
  price_inr: z.number().optional(),
  tags: z.array(z.string()).optional(),
  description: z.string().optional(),
  spice_level: z.number().optional(),
  is_veg: z.boolean().optional(),
  allergens: z.array(z.string()).optional(),
  gst_pct: z.number().optional(),
});
export type PatchMenuItemInput = z.infer<typeof patchMenuItemSchema>;

export type CreateMenuItemResponse = { ok: true; id: string };
export type DeleteMenuItemResponse = { ok: true } | { ok: false; reason: string };
export type PatchMenuItemResponse = { ok: true };
