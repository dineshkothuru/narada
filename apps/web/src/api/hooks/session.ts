import { useQuery } from "@tanstack/react-query";
import { ApiError, api } from "../client";
import { queryKeys } from "../keys";

export type CustomerSessionContext = {
  sessionId: string;
  serviceType: "dine_in" | "takeaway";
  tableLabel: string;
  outlet: { id: string; name: string; slug: string; tablesEnabled: boolean };
};

export type CustomerSessionInput = { outletSlug: string; tableCode?: string };

export type LegacyTableResolution = { outletSlug: string; tableCode?: string };

export function useLegacyTable(tableCode: string, enabled = true) {
  return useQuery({
    queryKey: ["outlet-table", tableCode] as const,
    queryFn: () => api<LegacyTableResolution>(`/outlets/table/${encodeURIComponent(tableCode)}`),
    enabled: enabled && tableCode.length > 0,
    retry: false,
    staleTime: Infinity,
  });
}

// A freshly-scanned phone at an already-active table joins the group's live
// order view. Asked once on load; the rounds poll takes over from there.
export function useSession(input: CustomerSessionInput, enabled = true) {
  const path = input.tableCode
    ? `/outlet/${encodeURIComponent(input.outletSlug)}/table/${encodeURIComponent(input.tableCode)}/session`
    : `/outlet/${encodeURIComponent(input.outletSlug)}/session`;
  return useQuery({
    queryKey: queryKeys.session(input.outletSlug, input.tableCode),
    queryFn: async () => {
      // Takeaway reloads can resume the cookie-bound session; a table QR starts
      // a fresh table context because the table is part of the route.
      if (!input.tableCode) {
        try {
          return await api<CustomerSessionContext>(path);
        } catch (error) {
          if (!(error instanceof ApiError) || ![401, 404].includes(error.status)) throw error;
        }
      }
      return api<CustomerSessionContext>(path, {
        method: "POST",
        body: JSON.stringify(input.tableCode ? {} : input),
      });
    },
    enabled: enabled && input.outletSlug.length > 0,
    retry: false,
    staleTime: 30_000,
  });
}
