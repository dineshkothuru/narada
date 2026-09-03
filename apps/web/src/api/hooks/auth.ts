import { useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "../client";
import { queryKeys } from "../keys";
import type { StaffRole } from "@/lib/roles";

export function useLogin() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (pin: string) =>
      api<{ ok: true; role: StaffRole; name: string }>("/admin/login", {
        method: "POST",
        body: JSON.stringify({ pin }),
      }),
    onSuccess: (data) => {
      qc.setQueryData(queryKeys.me, { role: data.role });
    },
  });
}

export function useLogout() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => api<{ ok: true }>("/admin/login", { method: "DELETE" }),
    onSuccess: () => {
      qc.setQueryData(queryKeys.me, undefined);
      qc.invalidateQueries({ queryKey: queryKeys.me });
    },
  });
}
