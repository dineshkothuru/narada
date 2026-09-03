import { useMutation } from "@tanstack/react-query";
import { api } from "../client";

export type SpinResult = { ok?: boolean; discountPct?: number; sliceIndex?: number };

// The SERVER draws the prize (the client only animates it) — unforgeable.
export function useSpinReward() {
  return useMutation({
    mutationFn: (tableCode: string) =>
      api<SpinResult>("/reward", {
        method: "POST",
        body: JSON.stringify({ tableCode, type: "spin" }),
      }),
  });
}

// The waiting game's free dessert goes to the kitchen as a ₹0 ticket.
export function useGameReward() {
  return useMutation({
    mutationFn: (tableCode: string) =>
      api<{ ok?: boolean; item?: string }>("/reward", {
        method: "POST",
        body: JSON.stringify({ tableCode, type: "comp" }),
      }),
  });
}

export function useCallWaiter() {
  return useMutation({
    mutationFn: (tableCode: string) =>
      api<{ ok: boolean }>("/waiter-call", {
        method: "POST",
        body: JSON.stringify({ tableCode }),
      }),
  });
}
