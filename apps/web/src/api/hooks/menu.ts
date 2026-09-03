import { useQuery } from "@tanstack/react-query";
import type { MenuPayload } from "@narada/shared";
import { api } from "../client";
import { queryKeys } from "../keys";

// The legacy Next page rendered the menu on the server (lib/menu.ts is
// server-only), so the SPA needs it over HTTP: GET /api/menu?table=<code>
// returns the same MenuPayload shape the old fetchMenu() resolved to.
export function useMenu(tableCode: string) {
  return useQuery({
    queryKey: queryKeys.menu(tableCode),
    queryFn: () => api<MenuPayload>(`/menu?table=${encodeURIComponent(tableCode)}`),
    enabled: tableCode.length > 0,
    staleTime: 30_000,
  });
}
