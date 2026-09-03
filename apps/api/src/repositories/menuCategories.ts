import type { Insertable, Kysely } from "kysely";
import type { DB, MenuCategoriesTable } from "../db/types.js";

export function makeMenuCategoriesRepo(db: Kysely<DB>) {
  return {
    listByOutlet: async (outletId: string) =>
      db
        .selectFrom("menu_categories")
        .selectAll()
        .where("outlet_id", "=", outletId)
        .orderBy("sort_order")
        .execute(),

    listForAdmin: async () =>
      db
        .selectFrom("menu_categories")
        .select(["id", "name", "emoji", "kind"])
        .orderBy("sort_order")
        .execute(),

    findOutletId: async (id: string) =>
      (await db
        .selectFrom("menu_categories")
        .select("outlet_id")
        .where("id", "=", id)
        .executeTakeFirst()) ?? null,

    // next sort_order for an appended section
    maxSortOrder: async () => {
      const row = await db
        .selectFrom("menu_categories")
        .select("sort_order")
        .orderBy("sort_order", "desc")
        .limit(1)
        .executeTakeFirst();
      return row?.sort_order ?? 0;
    },

    create: async (row: Insertable<MenuCategoriesTable>) =>
      db.insertInto("menu_categories").values(row).returning("id").executeTakeFirstOrThrow(),

    remove: async (id: string) => {
      await db.deleteFrom("menu_categories").where("id", "=", id).execute();
    },
  };
}
