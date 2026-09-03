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

    listForAdmin: async (outletId: string) => {
      let query = db
        .selectFrom("menu_categories")
        .select(["id", "name", "emoji", "kind"])
        .orderBy("sort_order");
      if (outletId) query = query.where("outlet_id", "=", outletId);
      return query.execute();
    },

    findOutletId: async (id: string, outletId: string) => {
      let query = db.selectFrom("menu_categories").select("outlet_id").where("id", "=", id);
      if (outletId) query = query.where("outlet_id", "=", outletId);
      return (await query.executeTakeFirst()) ?? null;
    },

    // next sort_order for an appended section
    maxSortOrder: async (outletId: string) => {
      let query = db
        .selectFrom("menu_categories")
        .select("sort_order")
        .orderBy("sort_order", "desc")
        .limit(1);
      if (outletId) query = query.where("outlet_id", "=", outletId);
      const row = await query.executeTakeFirst();
      return row?.sort_order ?? 0;
    },

    create: async (row: Insertable<MenuCategoriesTable>) =>
      db.insertInto("menu_categories").values(row).returning("id").executeTakeFirstOrThrow(),

    remove: async (id: string, outletId: string) => {
      let query = db.deleteFrom("menu_categories").where("id", "=", id);
      if (outletId) query = query.where("outlet_id", "=", outletId);
      await query.execute();
    },
  };
}
