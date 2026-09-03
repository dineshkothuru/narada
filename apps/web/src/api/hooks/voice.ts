import { useMutation } from "@tanstack/react-query";
import type { AnnaResponse, CartLine, ChatMessage } from "@narada/shared";
import { api } from "../client";

// /api/voice takes plain JSON — the recording arrives as base64 WAV in the
// body, so the shared api() client needs no multipart escape hatch.
export type VoiceTurnBody = {
  audio?: string; // base64 16k mono pcm16 wav — a spoken turn
  text?: string; // a tapped quick reply
  greet?: boolean; // opening line, no user input yet
  cart: CartLine[];
  messages: ChatMessage[];
  language: string;
  tableCode?: string;
  outletSlug?: string;
  sessionId?: string;
};

export type VoiceTurnResponse = AnnaResponse & {
  transcript: string;
  audio: string | null;
  detectedLanguage?: string;
  uiLanguage?: string;
  showItems: string[];
  quickReplies: string[];
};

export function useVoiceTurn() {
  return useMutation({
    mutationFn: (body: VoiceTurnBody) =>
      api<VoiceTurnResponse>("/voice", { method: "POST", body: JSON.stringify(body) }),
  });
}
