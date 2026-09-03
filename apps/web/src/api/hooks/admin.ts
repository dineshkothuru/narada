import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api, apiUpload } from "../client";
import { queryKeys } from "../keys";

// ---- Menu: categories, items, outlet settings ----------------------------

export type AdminCategory = {
  id: string;
  name: string;
  emoji: string | null;
  kind: "food" | "drink";
};

export type AdminItem = {
  id: string;
  category_id: string;
  name: string;
  description: string | null;
  price_inr: number;
  is_veg: boolean;
  is_available: boolean;
  tags: string[];
  spice_level: number;
  allergens: string[];
  gst_pct: number;
  image_url: string | null;
  emoji: string | null;
};

export type AdminOutlet = {
  id: string;
  name: string;
  upi_vpa: string | null;
  payment_timing: "pre" | "post";
  admin_pin: string;
  gemini_api_key: string | null;
  sarvam_api_key: string | null;
  comp_item_id: string | null;
  service_charge_pct: number;
  gstin: string | null;
};

export function useAdminMenu() {
  return useQuery({
    queryKey: queryKeys.adminMenu,
    queryFn: () =>
      api<{ categories: AdminCategory[]; items: AdminItem[]; outlet: AdminOutlet | null }>(
        "/admin/menu",
      ),
  });
}

export type ItemPatch = Partial<
  Pick<
    AdminItem,
    | "is_available"
    | "price_inr"
    | "tags"
    | "description"
    | "spice_level"
    | "is_veg"
    | "allergens"
    | "gst_pct"
    | "image_url"
  >
>;

export function usePatchItem() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ itemId, patch }: { itemId: string; patch: ItemPatch }) =>
      api("/admin/menu", { method: "PATCH", body: JSON.stringify({ itemId, ...patch }) }),
    onSettled: () => qc.invalidateQueries({ queryKey: queryKeys.adminMenu }),
  });
}

export function useAddItem() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: {
      category_id: string;
      name: string;
      price_inr: number;
      description?: string;
      is_veg?: boolean;
      spice_level?: number;
      emoji?: string;
    }) =>
      api<{ ok: true; id: string }>("/admin/menu", { method: "POST", body: JSON.stringify(body) }),
    onSettled: () => qc.invalidateQueries({ queryKey: queryKeys.adminMenu }),
  });
}

export function useDeleteItem() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (itemId: string) =>
      api<{ ok: boolean; reason?: string }>(`/admin/menu?itemId=${encodeURIComponent(itemId)}`, {
        method: "DELETE",
      }),
    onSettled: () => qc.invalidateQueries({ queryKey: queryKeys.adminMenu }),
  });
}

export function useAddCategory() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: { name: string; emoji?: string; kind?: string }) =>
      api<{ ok: true; id: string }>("/admin/categories", {
        method: "POST",
        body: JSON.stringify(body),
      }),
    onSettled: () => qc.invalidateQueries({ queryKey: queryKeys.adminMenu }),
  });
}

export function useDeleteCategory() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      api<{ ok: boolean; reason?: string }>(`/admin/categories?id=${encodeURIComponent(id)}`, {
        method: "DELETE",
      }),
    onSettled: () => qc.invalidateQueries({ queryKey: queryKeys.adminMenu }),
  });
}

export function useUploadItemImage() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ itemId, file }: { itemId: string; file: File }) => {
      const body = new FormData();
      body.append("itemId", itemId);
      body.append("file", file);
      return apiUpload<{ ok: true; imageUrl: string }>("/admin/image", body);
    },
    onSettled: () => qc.invalidateQueries({ queryKey: queryKeys.adminMenu }),
  });
}

export function useClearItemImage() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (itemId: string) =>
      api(`/admin/image?itemId=${encodeURIComponent(itemId)}`, { method: "DELETE" }),
    onSettled: () => qc.invalidateQueries({ queryKey: queryKeys.adminMenu }),
  });
}

export function usePatchSettings() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ outletId, patch }: { outletId: string; patch: Record<string, unknown> }) =>
      api("/admin/settings", { method: "PATCH", body: JSON.stringify({ outletId, ...patch }) }),
    onSettled: () => qc.invalidateQueries({ queryKey: queryKeys.adminMenu }),
  });
}

// ---- Staff -----------------------------------------------------------------

export type StaffRow = {
  id: string;
  name: string;
  role: "admin" | "kitchen" | "waiter" | "reception" | "cashier";
  pin: string;
  active: boolean;
};

export function useAdminStaff() {
  return useQuery({
    queryKey: queryKeys.adminStaff,
    queryFn: () => api<{ staff: StaffRow[] }>("/admin/staff"),
  });
}

export function useAddStaff() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: { name: string; role: string; pin: string }) =>
      api<{ ok: true }>("/admin/staff", { method: "POST", body: JSON.stringify(body) }),
    onSettled: () => qc.invalidateQueries({ queryKey: queryKeys.adminStaff }),
  });
}

export function usePatchStaff() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ staffId, active }: { staffId: string; active: boolean }) =>
      api("/admin/staff", { method: "PATCH", body: JSON.stringify({ staffId, active }) }),
    onSettled: () => qc.invalidateQueries({ queryKey: queryKeys.adminStaff }),
  });
}

export function useDeleteStaff() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      api(`/admin/staff?id=${encodeURIComponent(id)}`, { method: "DELETE" }),
    onSettled: () => qc.invalidateQueries({ queryKey: queryKeys.adminStaff }),
  });
}

// ---- Tables ------------------------------------------------------------------

export type AdminTable = {
  id: string;
  label: string;
  code: string;
  ui_variant: string;
  capacity: number;
};

export function useAdminTables() {
  return useQuery({
    queryKey: queryKeys.adminTables,
    queryFn: () => api<{ tables: AdminTable[]; outletName: string }>("/admin/tables"),
  });
}

export function useAddTables() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: {
      label?: string;
      count?: number;
      prefix?: string;
      ui_variant?: string;
      capacity?: number;
    }) =>
      api<{ ok: true; added: number }>("/admin/tables", {
        method: "POST",
        body: JSON.stringify(body),
      }),
    onSettled: () => qc.invalidateQueries({ queryKey: queryKeys.adminTables }),
  });
}

export function usePatchTable() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      tableId,
      ...patch
    }: {
      tableId: string;
      ui_variant?: string;
      label?: string;
      capacity?: number;
    }) => api("/admin/tables", { method: "PATCH", body: JSON.stringify({ tableId, ...patch }) }),
    onSettled: () => qc.invalidateQueries({ queryKey: queryKeys.adminTables }),
  });
}

export function useDeleteTable() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      api<{ ok: boolean; reason?: string }>(`/admin/tables?id=${encodeURIComponent(id)}`, {
        method: "DELETE",
      }),
    onSettled: () => qc.invalidateQueries({ queryKey: queryKeys.adminTables }),
  });
}

// ---- Orders history --------------------------------------------------------

export type AdminOrder = {
  id: string;
  status: string;
  total_inr: number;
  placed_via: "ui" | "anna";
  placed_by: string | null;
  created_at: string;
  session: {
    id: string;
    status: string;
    discount_pct: number;
    table: { label: string } | null;
    payments: { amount_inr: number; status: string; method: string }[];
  } | null;
  items: { name: string; qty: number; unit_price: number; status: string }[];
};

export type AdminOrderStats = {
  orders: number;
  tables: number;
  gross: number;
  netExpected: number;
  collected: number;
  outstanding: number;
  byVoice: number;
  avgTable: number;
  topDishes: { name: string; qty: number }[];
};

// Refreshed every 15s, matching the old orders page.
export function useAdminOrders(range: "today" | "week" | "all") {
  return useQuery({
    queryKey: queryKeys.adminOrders(range),
    queryFn: () =>
      api<{ orders: AdminOrder[]; stats: AdminOrderStats }>(
        `/admin/orders?range=${encodeURIComponent(range)}`,
      ),
    refetchInterval: () => (document.hidden ? false : 15000),
    refetchIntervalInBackground: false,
  });
}
