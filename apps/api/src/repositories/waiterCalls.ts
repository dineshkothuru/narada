import type { Insertable, Kysely } from "kysely";
import type { DB, WaiterCallsTable } from "../db/types.js";

export function makeWaiterCallsRepo(db: Kysely<DB>) {
  return {
    findOpenByTable: async (tableId: string, outletId: string) => {
      let query = db
        .selectFrom("waiter_calls")
        .select("id")
        .where("table_id", "=", tableId)
        .where("status", "=", "open")
        .limit(1);
      query = query.where("outlet_id", "=", outletId);
      return (await query.executeTakeFirst()) ?? null;
    },

    listOpen: async (outletId: string) => {
      let query = db
        .selectFrom("waiter_calls")
        .select(["id", "table_id", "created_at"])
        .where("status", "=", "open")
        .orderBy("created_at");
      query = query.where("outlet_id", "=", outletId);
      return query.execute();
    },

    findOpenById: async (id: string, outletId: string) => {
      let query = db
        .selectFrom("waiter_calls")
        .select(["id", "table_id"])
        .where("id", "=", id)
        .where("status", "=", "open");
      query = query.where("outlet_id", "=", outletId);
      return (await query.executeTakeFirst()) ?? null;
    },

    create: async (row: Insertable<WaiterCallsTable>) => {
      await db.insertInto("waiter_calls").values(row).execute();
    },

    ack: async (id: string, ackedAt: string, ackedBy: string | null, outletId: string) => {
      let query = db
        .updateTable("waiter_calls")
        .set({ status: "done", acked_at: ackedAt, acked_by: ackedBy })
        .where("id", "=", id);
      query = query.where("outlet_id", "=", outletId);
      await query.execute();
    },

    closeOpenByTables: async (tableIds: string[], reason: string, outletId: string) => {
      if (tableIds.length === 0) return;
      await db
        .updateTable("waiter_calls")
        .set({
          status: "done",
          acked_at: new Date().toISOString(),
          acked_by: `auto · ${reason}`.slice(0, 60),
        })
        .where("table_id", "in", tableIds)
        .where("status", "=", "open")
        .where("outlet_id", "=", outletId)
        .execute();
    },
  };
}
