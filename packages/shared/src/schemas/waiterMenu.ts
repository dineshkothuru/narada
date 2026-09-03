import type { z } from "zod";
import { z as zod } from "zod";

export const waiterMenuQuerySchema = zod.object({ table: zod.string().min(1, "table required") });
export type WaiterMenuQuery = z.infer<typeof waiterMenuQuerySchema>;
export type WaiterMenuResponse = {
  tableLabel: string;
  categories: { id: string; name: string; emoji: string }[];
  items: {
    id: string;
    categoryId: string;
    name: string;
    priceInr: number;
    isVeg: boolean;
    isAvailable: boolean;
    emoji: string;
  }[];
};
