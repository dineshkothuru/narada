import { z } from "zod";

// POST /api/admin/categories — create a menu section.
export const createCategorySchema = z.object({
  name: z.string().min(1, "name required"),
  emoji: z.string().optional(),
  kind: z.string().optional(),
});
export type CreateCategoryInput = z.infer<typeof createCategorySchema>;

// DELETE /api/admin/categories?id=<id>
export const deleteCategoryQuerySchema = z.object({
  id: z.string().min(1, "id required"),
});
export type DeleteCategoryQuery = z.infer<typeof deleteCategoryQuerySchema>;

export type CreateCategoryResponse = { ok: true; id: string };
export type DeleteCategoryResponse = { ok: true } | { ok: false; reason: string };
