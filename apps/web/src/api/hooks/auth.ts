import { useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "../client";
import { queryKeys } from "../keys";
import type { StaffRole } from "@/lib/roles";

export type OutletChoice = { id: string; name: string; slug: string };
export type StaffIdentity = {
  id: string;
  username: string;
  firstName: string;
  lastName?: string | null;
  displayName: string;
};
export type StaffLoginResponse = {
  ok: true;
  role: StaffRole;
  staff: StaffIdentity;
  outlet: OutletChoice;
};

export type CustomerIdentity = {
  id: string;
  phone: string;
  firstName: string;
  lastName?: string | null;
  displayName: string;
};

export type CustomerAuthResponse = {
  ok: true;
  customer: CustomerIdentity;
};

export function useOutletLogin(slug: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ username, password }: { username: string; password: string }) =>
      api<StaffLoginResponse>(`/outlet/${encodeURIComponent(slug)}/login`, {
        method: "POST",
        body: JSON.stringify({ username, password }),
      }),
    onSuccess: (data) => {
      qc.setQueryData(queryKeys.me, {
        role: data.role,
        staffId: data.staff.id,
        outletId: data.outlet.id,
        username: data.staff.username,
        firstName: data.staff.firstName,
        lastName: data.staff.lastName ?? null,
        displayName: data.staff.displayName,
      });
    },
  });
}

export function useLogout() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => api<{ ok: true }>("/auth/staff/logout", { method: "DELETE" }),
    onSuccess: () => {
      qc.setQueryData(queryKeys.me, undefined);
      qc.invalidateQueries({ queryKey: queryKeys.me });
    },
  });
}

export function useCustomerSignup() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: { phone: string; password: string; firstName: string; lastName?: string }) =>
      api<CustomerAuthResponse>("/auth/customer/signup", {
        method: "POST",
        body: JSON.stringify(body),
      }),
    onSuccess: (data) => {
      qc.setQueryData(queryKeys.customerMe, data.customer);
    },
  });
}

export function useCustomerLogin() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ phone, password }: { phone: string; password: string }) =>
      api<CustomerAuthResponse>("/auth/customer/login", {
        method: "POST",
        body: JSON.stringify({ phone, password }),
      }),
    onSuccess: (data) => {
      qc.setQueryData(queryKeys.customerMe, data.customer);
    },
  });
}
