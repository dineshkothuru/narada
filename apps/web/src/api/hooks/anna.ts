import { useMutation } from "@tanstack/react-query";
import type { AnnaResponse, CartLine, ChatMessage } from "@narada/shared";
import { api } from "../client";

export type AskAnnaBody = {
  messages: ChatMessage[];
  cart: CartLine[];
  language: string;
  tableCode: string;
};

export function useAskAnna() {
  return useMutation({
    mutationFn: (body: AskAnnaBody) =>
      api<AnnaResponse>("/anna", { method: "POST", body: JSON.stringify(body) }),
  });
}
