import { z } from "zod";

// POST /api/admin/login
export const adminLoginSchema = z.object({
  pin: z.string().min(1, "pin required"),
});
export type AdminLoginInput = z.infer<typeof adminLoginSchema>;

export type AdminLoginResponse = { ok: true; role: string; name: string };
