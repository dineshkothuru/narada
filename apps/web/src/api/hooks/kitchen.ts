import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../client";
import { queryKeys } from "../keys";

export type KitchenItem = {
  id: string;
  name: string;
  qty: number;
  notes: string | null;
  status: "queued" | "preparing" | "ready" | "served";
};

export type KitchenOrder = {
  id: string;
  orderNo?: string;
  status: "placed" | "preparing" | "ready" | "served";
  total_inr: number;
  placed_via: "ui" | "anna";
  lang: string | null;
  created_at: string;
  session: { table: { label: string } | null } | null;
  items: KitchenItem[];
};

// Polls every 5s while the tab is visible, matching the old page's
// setInterval + visibilitychange behaviour.
export function useKitchenOrders() {
  return useQuery({
    queryKey: queryKeys.kitchen,
    queryFn: () => api<{ orders: KitchenOrder[] }>("/kitchen"),
    refetchInterval: () => (document.hidden ? false : 5000),
    refetchIntervalInBackground: false,
  });
}

export function useAdvanceOrder() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ orderId, status }: { orderId: string; status: string }) =>
      api("/kitchen", {
        method: "PATCH",
        body: JSON.stringify({ orderId, status }),
      }),
    onSettled: () => qc.invalidateQueries({ queryKey: queryKeys.kitchen }),
  });
}

export function useCycleItemStatus() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ itemId, itemStatus }: { itemId: string; itemStatus: string }) =>
      api("/kitchen", {
        method: "PATCH",
        body: JSON.stringify({ itemId, itemStatus }),
      }),
    onSettled: () => qc.invalidateQueries({ queryKey: queryKeys.kitchen }),
  });
}
