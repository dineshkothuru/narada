import { z } from "zod";

// POST /api/waiter-call — customer rings the waiter for their table.
export const waiterCallSchema = z.object({
  tableCode: z.string().min(1, "tableCode required"),
});
export type WaiterCallInput = z.infer<typeof waiterCallSchema>;
