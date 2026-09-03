import { z } from "zod";

// GET /api/session?table=<code> — is there already an active session for this table?
export const sessionQuerySchema = z.object({
  table: z.string().min(1, "table required"),
});
export type SessionQuery = z.infer<typeof sessionQuerySchema>;

export type SessionResponse = { sessionId: string | null };
