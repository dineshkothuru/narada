import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
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
  lines: {
    name: string;
    qty: number;
    unitPrice: number;
    lineTotal: number;
    // the printable receipt shows per-line GST; the staff sheet ignores it
    gstPct?: number;
  }[];
  gross: number;
  discountPct: number;
  discount: number;
  // taxable value and the CGST/SGST split only ride along on the full receipt
  taxable?: number;
  gstBreakup?: { pct: number; cgst: number; sgst: number }[];
  gst: number;
  serviceChargePct: number;
  serviceWaived: boolean;
  service: number;
  tip: number;
  net: number;
  paid: number;
  status?: string;
  outletName?: string;
  gstin?: string | null;
  tableLabel?: string;
  settledAt?: string | null;
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

// The guest's live preview inside the order sheet. Unlike useBill it carries
// the tip being previewed and is only asked for while the sheet is open, so it
// keys on the tip and does not poll on its own.
export function useCustomerBill(sessionId: string | null, tip: number, enabled: boolean) {
  return useQuery({
    queryKey: queryKeys.customerBill(sessionId ?? "", tip),
    queryFn: () => api<BillSheet>(`/bill?session=${encodeURIComponent(sessionId!)}&tip=${tip}`),
    enabled: enabled && sessionId !== null,
  });
}

// One-shot read for the printable /bill/:session page — no polling, and a
// missing or unknown session should surface as an error, not a retry storm.
export function useBillReceipt(sessionId: string) {
  return useQuery({
    queryKey: queryKeys.bill(sessionId),
    queryFn: () => api<BillSheet>(`/bill?session=${encodeURIComponent(sessionId)}`),
    enabled: sessionId.length > 0,
    retry: false,
  });
}

// The guest's legal right in India: ask for the service charge to come off.
// The same endpoint records a tip.
export function usePatchBill() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: {
      sessionId: string;
      tableCode: string;
      serviceWaived?: boolean;
      tip?: number;
    }) => api<BillSheet>("/bill", { method: "PATCH", body: JSON.stringify(body) }),
    onSettled: (_data, _err, vars) => {
      qc.invalidateQueries({ queryKey: queryKeys.bill(vars.sessionId) });
    },
  });
}
