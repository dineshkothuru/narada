import type { WaiterMenuResponse } from "@narada/shared";
import type { Repos } from "../repositories/index.js";
import { notFound } from "../lib/http.js";

export async function waiterMenu(
  repos: Pick<Repos, "tables" | "menuCategories" | "menuItems">,
  tableCode: string,
  outletId: string,
): Promise<WaiterMenuResponse> {
  const table = await repos.tables.findByCodeForOutlet(tableCode, outletId);
  if (!table) throw notFound("unknown table");
  const [categories, items] = await Promise.all([
    repos.menuCategories.listByOutlet(outletId),
    repos.menuItems.listByOutlet(outletId),
  ]);
  return {
    tableLabel: table.label,
    categories: categories.map((category) => ({
      id: category.id,
      name: category.name,
      emoji: category.emoji ?? "🍽️",
    })),
    items: items.map((item) => ({
      id: item.id,
      categoryId: item.category_id,
      name: item.name,
      priceInr: Number(item.price_inr),
      isVeg: item.is_veg,
      isAvailable: item.is_available !== false,
      emoji: item.emoji ?? "🍽️",
    })),
  };
}
