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

    findByCodeForOutlet: async (code: string, outletId: string) =>
      (await db
        .selectFrom("tables")
        .select(["id", "outlet_id", "label", "ui_variant"])
        .where("code", "=", code)
        .where("outlet_id", "=", outletId)
        .limit(1)
        .executeTakeFirst()) ?? null,

    findById: async (id: string, outletId: string) => {
      let query = db.selectFrom("tables").selectAll().where("id", "=", id);
      if (outletId) query = query.where("outlet_id", "=", outletId);
      return (await query.executeTakeFirst()) ?? null;
    },

    listAll: async (outletId: string) => {
      let query = db.selectFrom("tables").selectAll().orderBy("label");
      if (outletId) query = query.where("outlet_id", "=", outletId);
      return query.execute();
    },

    // the admin table screen only needs the editable columns
    listForAdmin: async (outletId: string) => {
      let query = db
        .selectFrom("tables")
        .select(["id", "label", "code", "ui_variant", "capacity"])
        .orderBy("label");
      if (outletId) query = query.where("outlet_id", "=", outletId);
      return query.execute();
    },

    listLabelsAndCodes: async (outletId: string) => {
      let query = db.selectFrom("tables").select(["label", "code"]);
      if (outletId) query = query.where("outlet_id", "=", outletId);
      return query.execute();
    },

    createMany: async (rows: Insertable<TablesTable>[]) => {
      if (rows.length === 0) return;
      await db.insertInto("tables").values(rows).execute();
    },

    update: async (id: string, patch: Updateable<TablesTable>, outletId: string) => {
      let query = db.updateTable("tables").set(patch).where("id", "=", id);
      if (outletId) query = query.where("outlet_id", "=", outletId);
      await query.execute();
    },

    setNeedsCleaning: async (ids: string[], needsCleaning: boolean, outletId: string) => {
      if (ids.length === 0) return;
      let query = db
        .updateTable("tables")
        .set({ needs_cleaning: needsCleaning })
        .where("id", "in", ids);
      if (outletId) query = query.where("outlet_id", "=", outletId);
      await query.execute();
    },

    // seating a table settles the question of whether it was cleaned; the
    // needs_cleaning=true filter keeps it a no-op when it was already clear
    clearCleaningIfNeeded: async (id: string, outletId: string) => {
      let query = db
        .updateTable("tables")
        .set({ needs_cleaning: false })
        .where("id", "=", id)
        .where("needs_cleaning", "=", true);
      if (outletId) query = query.where("outlet_id", "=", outletId);
      await query.execute();
    },

    remove: async (id: string, outletId: string) => {
      let query = db.deleteFrom("tables").where("id", "=", id);
      if (outletId) query = query.where("outlet_id", "=", outletId);
      await query.execute();
    },
  };
}
