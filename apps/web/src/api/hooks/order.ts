import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { CartLine, Lang } from "@narada/shared";
import { api } from "../client";
import { queryKeys } from "../keys";

export type OrderRoundItem = { name: string; qty: number; status?: string };
export type OrderRound = {
  id: string;
  status: string;
  total_inr: number;
  placed_by?: string | null;
  items: OrderRoundItem[];
};

export type SessionOrders = {
  sessionStatus?: string;
  rounds?: OrderRound[];
  discountPct?: number;
  status?: string;
};

export type PlacedOrder = {
  total?: number;
  orderId?: string | null;
  sessionId?: string | null;
  discountPct?: number;
};

// Live kitchen progress for the whole table session, every round. Matches the
// legacy 8s setInterval that skipped ticks while the phone was locked.
export function useOrderRounds(sessionId: string | null, orderId: string | null) {
  const query = sessionId
    ? `/order?session=${encodeURIComponent(sessionId)}`
    : `/order?id=${encodeURIComponent(orderId ?? "")}`;
  return useQuery({
    queryKey: queryKeys.orderRounds(sessionId ?? orderId ?? ""),
    queryFn: () => api<SessionOrders>(query),
    enabled: Boolean(sessionId ?? orderId),
    refetchInterval: () => (document.hidden ? false : 8000),
    refetchIntervalInBackground: false,
  });
}

export function usePlaceOrder() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: {
      tableCode: string;
      cart: CartLine[];
      placedVia: "ui" | "anna";
      guestName: string;
      lang: Lang;
    }) => api<PlacedOrder>("/order", { method: "POST", body: JSON.stringify(body) }),
    onSettled: (data) => {
      if (data?.sessionId) {
        qc.invalidateQueries({ queryKey: queryKeys.orderRounds(data.sessionId) });
      }
    },
  });
}
