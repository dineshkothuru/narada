import type { Insertable, Kysely, Updateable } from "kysely";
import type { DB, MenuItemsTable } from "../db/types.js";

export function makeMenuItemsRepo(db: Kysely<DB>) {
  return {
    listByOutlet: async (outletId: string) =>
      db
        .selectFrom("menu_items")
        .selectAll()
        .where("outlet_id", "=", outletId)
        .orderBy("sort_order")
        .execute(),

    listForAdmin: async () =>
      db
        .selectFrom("menu_items")
        .select([
          "id",
          "category_id",
          "name",
          "description",
          "price_inr",
          "is_veg",
          "is_available",
          "tags",
          "spice_level",
          "allergens",
          "gst_pct",
        ])
        .orderBy("sort_order")
        .execute(),

    // prices for a cart, in one round trip
    findPricesByIds: async (ids: string[]) => {
      if (ids.length === 0) return [];
      return db
        .selectFrom("menu_items")
        .select(["id", "name", "price_inr", "gst_pct"])
        .where("id", "in", ids)
        .execute();
    },

    findById: async (id: string) =>
      (await db
        .selectFrom("menu_items")
        .select(["id", "name"])
        .where("id", "=", id)
        .executeTakeFirst()) ?? null,

    // the comp prize falls back to a dish looked up by name
    findByName: async (outletId: string, name: string) =>
      (await db
        .selectFrom("menu_items")
        .select(["id", "name"])
        .where("outlet_id", "=", outletId)
        .where("name", "=", name)
        .limit(1)
        .executeTakeFirst()) ?? null,

    create: async (row: Insertable<MenuItemsTable>) =>
      db.insertInto("menu_items").values(row).returning("id").executeTakeFirstOrThrow(),

    update: async (id: string, patch: Updateable<MenuItemsTable>) => {
      await db.updateTable("menu_items").set(patch).where("id", "=", id).execute();
    },

    // dish photo: null clears it and the customer menu falls back to the emoji
    setImageUrl: async (id: string, url: string | null) => {
      await db.updateTable("menu_items").set({ image_url: url }).where("id", "=", id).execute();
    },

    // a section whose dishes have order history cannot be deleted; hiding its
    // dishes is the fallback that keeps the history intact
    hideByCategory: async (categoryId: string) => {
      await db
        .updateTable("menu_items")
        .set({ is_available: false })
        .where("category_id", "=", categoryId)
        .execute();
    },

    remove: async (id: string) => {
      await db.deleteFrom("menu_items").where("id", "=", id).execute();
    },
  };
}
