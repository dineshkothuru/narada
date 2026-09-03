import { useQuery } from "@tanstack/react-query";
import { api, ApiError } from "../client";
import { queryKeys } from "../keys";
import type { StaffRole } from "@/lib/roles";

export type MeResponse = {
  role: StaffRole;
  staffId: string;
  outletId: string;
  username: string;
  firstName: string;
  lastName?: string | null;
  displayName: string;
};

// GET /api/admin/me — "who am I". 401 means logged out, surfaced via
// ApiError.status rather than throwing the query into a generic error state.
export function useMe() {
  return useQuery({
    queryKey: queryKeys.me,
    queryFn: () => api<MeResponse>("/admin/me"),
    retry: (failureCount, error) => {
      if (error instanceof ApiError && error.status === 401) return false;
      return failureCount < 1;
    },
  });
}
