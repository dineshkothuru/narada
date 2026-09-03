import { useQuery } from "@tanstack/react-query";
import { api } from "../client";
import { queryKeys } from "../keys";

export function useHealth() {
  return useQuery({
    queryKey: queryKeys.health,
    queryFn: () => api<{ ok: boolean }>("/health"),
  });
}
