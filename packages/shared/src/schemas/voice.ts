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

// POST /api/voice — one turn of the voice assistant: spoken audio, a typed
// quick-reply, or a silent "greet" trigger. Exactly one of the three drives
// the turn; the size cap on audio matches the legacy 4MB base64 limit.
export const voiceSchema = z
  .object({
    audio: z.string().optional(),
    text: z.string().optional(),
    greet: z.boolean().optional(),
    cart: z.array(cartLineSchema).optional(),
    messages: z.array(chatMessageSchema).optional(),
    tableCode: z.string().optional(),
    outletSlug: z.string().optional(),
    language: z.string().optional(),
  })
  .refine((v) => Boolean(v.audio || v.text || v.greet), {
    message: "audio, text or greet required",
  });
export type VoiceInput = z.infer<typeof voiceSchema>;

export type VoiceResponse = {
  transcript: string;
  detectedLanguage: string;
  uiLanguage: "en" | "hi" | "te";
  reply: string;
  actions: unknown[];
  suggestCheckout?: boolean;
  showItems: string[];
  quickReplies: string[];
  audio: string | null;
};
