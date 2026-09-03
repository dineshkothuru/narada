import type { Insertable, Kysely, Updateable } from "kysely";
import type { DB, TablesTable } from "../db/types.js";

export function makeTablesRepo(db: Kysely<DB>) {
  return {
    findByCode: async (code: string) =>
      (await db
        .selectFrom("tables")
        .select(["id", "outlet_id", "label", "ui_variant"])
        .where("code", "=", code)
        .limit(1)
        .executeTakeFirst()) ?? null,

    findById: async (id: string) =>
      (await db.selectFrom("tables").selectAll().where("id", "=", id).executeTakeFirst()) ?? null,

    listAll: async () => db.selectFrom("tables").selectAll().orderBy("label").execute(),

    // the admin table screen only needs the editable columns
    listForAdmin: async () =>
      db
        .selectFrom("tables")
        .select(["id", "label", "code", "ui_variant", "capacity"])
        .orderBy("label")
        .execute(),

    listLabelsAndCodes: async () => db.selectFrom("tables").select(["label", "code"]).execute(),

    createMany: async (rows: Insertable<TablesTable>[]) => {
      if (rows.length === 0) return;
      await db.insertInto("tables").values(rows).execute();
    },

    update: async (id: string, patch: Updateable<TablesTable>) => {
      await db.updateTable("tables").set(patch).where("id", "=", id).execute();
    },

    setNeedsCleaning: async (ids: string[], needsCleaning: boolean) => {
      if (ids.length === 0) return;
      await db
        .updateTable("tables")
        .set({ needs_cleaning: needsCleaning })
        .where("id", "in", ids)
        .execute();
    },

    // seating a table settles the question of whether it was cleaned; the
    // needs_cleaning=true filter keeps it a no-op when it was already clear
    clearCleaningIfNeeded: async (id: string) => {
      await db
        .updateTable("tables")
        .set({ needs_cleaning: false })
        .where("id", "=", id)
        .where("needs_cleaning", "=", true)
        .execute();
    },

    remove: async (id: string) => {
      await db.deleteFrom("tables").where("id", "=", id).execute();
    },
  };
}
