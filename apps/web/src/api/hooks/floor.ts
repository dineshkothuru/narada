import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../client";
import { queryKeys } from "../keys";
import type { TableStatus } from "@narada/shared";

export type FloorTable = {
  id: string;
  label: string;
  code: string;
  capacity: number;
  zone: string | null;
  status: TableStatus;
  billNo: string | null;
  sessionId: string | null;
  isMerged: boolean;
  mergedWith: string[];
  since: string | null;
  guests: number | null;
  rounds: number;
  served: number;
  pending: number;
  due: number;
  attendant: string | null;
  langs: string[];
  calling: boolean;
  callId: string | null;
  callSince: string | null;
};

export type FloorStats = {
  total: number;
  free: number;
  cleaning: number;
  billed: number;
  seated: number;
  dining: number;
  settling: number;
  paid: number;
  seats: number;
  seatsBusy: number;
};

export function useFloor(enabled = true) {
  return useQuery({
    queryKey: queryKeys.floor,
    queryFn: () => api<{ tables: FloorTable[]; stats: FloorStats }>("/floor"),
    enabled,
    refetchInterval: () => (document.hidden ? false : 5000),
    refetchIntervalInBackground: false,
  });
}

export type FloorAction =
  | { action: "seat"; tableId: string; guests: number }
  | { action: "release"; sessionId: string }
  | { action: "merge"; sessionId: string; intoSessionId: string }
  | { action: "unmerge"; sessionId: string }
  | { action: "attendant"; sessionId: string }
  | { action: "clear_table"; tableId: string };

export function useFloorAction() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: FloorAction) =>
      api("/floor", {
        method: "PATCH",
        body: JSON.stringify(body),
      }),
    onSettled: () => qc.invalidateQueries({ queryKey: queryKeys.floor }),
  });
}
