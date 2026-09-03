import { useQuery } from "@tanstack/react-query";
import { api } from "../client";
import { queryKeys } from "../keys";

export type SessionLookup = { sessionId: string | null };

// A freshly-scanned phone at an already-active table joins the group's live
// order view. Asked once on load; the rounds poll takes over from there.
export function useSession(tableCode: string, enabled = true) {
  return useQuery({
    queryKey: queryKeys.session(tableCode),
    queryFn: () => api<SessionLookup>(`/session?table=${encodeURIComponent(tableCode)}`),
    enabled: enabled && tableCode.length > 0,
    retry: false,
    staleTime: Infinity,
  });
}
