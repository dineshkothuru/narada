import { z } from "zod";

// GET /api/menu?table=<code> — the customer SPA's menu bootstrap request.
export const menuQuerySchema = z.object({
  table: z.string().min(1, "table required"),
});
export type MenuQuery = z.infer<typeof menuQuerySchema>;
