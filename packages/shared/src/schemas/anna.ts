import { z } from "zod";

const chatMessageSchema = z.object({
  role: z.enum(["user", "assistant"]),
  text: z.string(),
});

const cartLineSchema = z.object({
  itemId: z.string(),
  qty: z.number(),
  notes: z.string().optional(),
});

// POST /api/anna — one turn of the text chat assistant.
export const annaSchema = z.object({
  messages: z.array(chatMessageSchema).min(1, "messages required"),
  cart: z.array(cartLineSchema).optional(),
  language: z.string().optional(),
  tableCode: z.string().optional(),
});
export type AnnaInput = z.infer<typeof annaSchema>;
