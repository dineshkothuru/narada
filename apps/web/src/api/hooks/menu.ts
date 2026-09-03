import { useQuery } from "@tanstack/react-query";
import type { MenuPayload } from "@narada/shared";
import { api } from "../client";
import { queryKeys } from "../keys";

// The legacy Next page rendered the menu on the server (lib/menu.ts is
// server-only), so the SPA needs it over HTTP: GET /api/menu?outletSlug=<slug>&tableCode=<code>
// returns the same MenuPayload shape the old fetchMenu() resolved to.
export type MenuContext = { outletSlug: string; tableCode?: string };

export function useMenu({ outletSlug, tableCode }: MenuContext) {
  return useQuery({
    queryKey: queryKeys.menu(outletSlug, tableCode),
    queryFn: () =>
      api<MenuPayload>(
        tableCode
          ? `/outlet/${encodeURIComponent(outletSlug)}/menu?tableCode=${encodeURIComponent(tableCode)}`
          : `/outlet/${encodeURIComponent(outletSlug)}/menu`,
      ),
    enabled: outletSlug.length > 0,
    staleTime: 30_000,
  });
}
