import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../client";
import { queryKeys } from "../keys";
import type { TableStatus } from "@narada/shared";

export type WaiterOrder = {
  id: string;
  status: string;
  total_inr: number;
  created_at: string;
  items: { id: string; name: string; qty: number; status: string }[];
};

export type WaiterSession = {
  id: string;
  since: string;
  guests: number | null;
  status: TableStatus;
  orders: WaiterOrder[];
  ordered: number;
  paid: number;
  attendant: string | null;
  langs: string[];
  billNo: string | null;
  discountPct: number;
  gst: number;
  service: number;
  serviceWaived: boolean;
  due: number;
};

export type WaiterTable = {
  tableId: string;
  label: string;
  code: string;
  capacity: number;
  call: { id: string; created_at: string } | null;
  needsCleaning: boolean;
  session: WaiterSession | null;
};

// Polls every 5s while the tab is visible, matching the old page's
// setInterval + visibilitychange behaviour.
export function useWaiterTables() {
  return useQuery({
    queryKey: queryKeys.waiter,
    queryFn: () => api<{ tables: WaiterTable[] }>("/waiter"),
    refetchInterval: () => (document.hidden ? false : 5000),
    refetchIntervalInBackground: false,
  });
}

export type WaiterMenuResponse = {
  tableLabel: string;
  categories: { id: string; name: string; emoji: string }[];
  items: {
    id: string;
    categoryId: string;
    name: string;
    priceInr: number;
    isVeg: boolean;
    isAvailable: boolean;
    emoji: string;
  }[];
};

export function useWaiterMenu(tableCode: string) {
  return useQuery({
    queryKey: ["waiter", "menu", tableCode] as const,
    queryFn: () => api<WaiterMenuResponse>(`/waiter/menu?table=${encodeURIComponent(tableCode)}`),
    enabled: tableCode.length > 0,
    staleTime: 30_000,
  });
}

export type WaiterDictateResponse = {
  transcript: string;
  lines: { itemId: string; qty: number; name: string }[];
  unmatched: string[];
};

export function useWaiterDictate() {
  return useMutation({
    mutationFn: (body: { tableCode: string; audio?: string; text?: string }) =>
      api<WaiterDictateResponse>("/waiter/dictate", {
        method: "POST",
        body: JSON.stringify(body),
      }),
  });
}

export type WaiterAction =
  | { action: "ack_call"; callId: string; sessionId?: string; attendedBy?: string }
  | { action: "mark_served"; orderId: string }
  | { action: "mark_item_served"; itemId: string }
  | { action: "cancel_item"; itemId: string; reason?: string }
  | { action: "clear_table"; tableId: string }
  | {
      action: "record_payment";
      sessionId: string;
      amount: number;
      method: "upi_intent" | "cash" | "card";
      utr?: string;
    };

export function useWaiterAction() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: WaiterAction) =>
      api("/waiter", {
        method: "PATCH",
        body: JSON.stringify(body),
      }),
    onSettled: () => qc.invalidateQueries({ queryKey: queryKeys.waiter }),
  });
}

export type TipsBoard = {
  rows: { attendant: string; tips: number; tables: number }[];
  unassigned: number;
  total: number;
};

// Refreshed every 30s, matching the old TipsBoard component.
export function useTips() {
  return useQuery({
    queryKey: queryKeys.tips,
    queryFn: () => api<TipsBoard>("/waiter/tips"),
    refetchInterval: () => (document.hidden ? false : 30000),
    refetchIntervalInBackground: false,
  });
}
