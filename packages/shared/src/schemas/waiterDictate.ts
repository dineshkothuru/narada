import { z } from "zod";

export const waiterDictateSchema = z.object({
  tableCode: z.string().min(1, "tableCode required"),
  audio: z.string().optional(),
  text: z.string().optional(),
});
export type WaiterDictateInput = z.infer<typeof waiterDictateSchema>;
export type WaiterDictateResponse = {
  transcript: string;
  lines: { itemId: string; qty: number; name: string }[];
  unmatched: string[];
};
