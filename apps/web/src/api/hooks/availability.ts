import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../client";
import { queryKeys } from "../keys";

export type AvailabilityDish = { id: string; name: string; is_available: boolean };
export type AvailabilityEvent = {
  action: "dish_sold_out" | "dish_back_on";
  role: string | null;
  actor_name: string | null;
  details: Record<string, unknown> | null;
  created_at: string;
};
export type AvailabilityResponse = { menu: AvailabilityDish[]; recent: AvailabilityEvent[] };

export function useAvailability() {
  return useQuery({
    queryKey: queryKeys.availability,
    queryFn: () => api<AvailabilityResponse>("/availability"),
    refetchInterval: () => (document.hidden ? false : 15_000),
    refetchIntervalInBackground: false,
  });
}

export function usePatchAvailability() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ menuItemId, available }: { menuItemId: string; available: boolean }) =>
      api("/availability", {
        method: "PATCH",
        body: JSON.stringify({ menuItemId, available }),
      }),
    onSettled: () => qc.invalidateQueries({ queryKey: queryKeys.availability }),
  });
}
