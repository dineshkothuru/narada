import { useQuery } from "@tanstack/react-query";
import { api } from "../client";
import { queryKeys } from "../keys";

type RoundItem = { id: string; name: string; qty: number; status: string };
type Round = {
  id: string;
  status: string;
  createdAt: string;
  placedBy: string | null;
  placedVia: string | null;
  totalInr: number;
  items: RoundItem[];
};
export type BillSheet = {
  billNo: string | null;
  lines: { name: string; qty: number; unitPrice: number; lineTotal: number }[];
  gross: number;
  discountPct: number;
  discount: number;
  gst: number;
  serviceChargePct: number;
  serviceWaived: boolean;
  service: number;
  tip: number;
  net: number;
  paid: number;
  rounds: Round[];
};

// Polled every 8s while a TableSheet is open, matching the legacy component.
export function useBill(sessionId: string | null) {
  return useQuery({
    queryKey: queryKeys.bill(sessionId ?? ""),
    queryFn: () => api<BillSheet>(`/bill?session=${encodeURIComponent(sessionId!)}`),
    enabled: sessionId !== null,
    refetchInterval: 8000,
  });
}
