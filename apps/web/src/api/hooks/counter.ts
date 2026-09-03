import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../client";
import { queryKeys } from "../keys";

export type CounterTab = {
  sessionId: string;
  tableId: string;
  code: string;
  label: string;
  mergedWith: string[];
  since: string;
  attendant: string | null;
  billNo: string | null;
  rounds: number;
  unserved: number;
  gross: number;
  discount: number;
  gst: number;
  service: number;
  serviceWaived: boolean;
  paid: number;
  due: number;
};

// Polls every 5s while the tab is visible, matching the old page's
// setInterval + visibilitychange behaviour.
export function useCounterTabs() {
  return useQuery({
    queryKey: queryKeys.counter,
    queryFn: () => api<{ tabs: CounterTab[] }>("/counter"),
    refetchInterval: () => (document.hidden ? false : 5000),
    refetchIntervalInBackground: false,
  });
}

export type CounterAction =
  | { action: "generate_bill"; sessionId: string }
  | { action: "waive_service"; sessionId: string; waived: boolean }
  | {
      action: "record_payment";
      sessionId: string;
      amount: number;
      method: "upi_intent" | "cash" | "card";
      utr?: string;
    };

export function useCounterAction() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: CounterAction) =>
      api("/counter", {
        method: "PATCH",
        body: JSON.stringify(body),
      }),
    onSettled: () => qc.invalidateQueries({ queryKey: queryKeys.counter }),
  });
}
