import { z } from "zod";

// Legacy table lookup. New customer sessions use an outlet-specific URL.
export const sessionQuerySchema = z.object({
  table: z.string().min(1, "table required"),
});
export type SessionQuery = z.infer<typeof sessionQuerySchema>;

export type SessionResponse = { sessionId: string | null };

export const customerSessionSchema = z.object({
  tableCode: z.string().min(1).optional(),
});
export type CustomerSessionInput = z.infer<typeof customerSessionSchema>;

export type CustomerSessionResponse = {
  sessionId: string;
  serviceType: "dine_in" | "takeaway";
  tableLabel: string;
  outlet: { id: string; name: string; slug: string; tablesEnabled: boolean };
};
