import type { Insertable, Kysely } from "kysely";
import type { DB, WaiterCallsTable } from "../db/types.js";

export function makeWaiterCallsRepo(db: Kysely<DB>) {
  return {
    findOpenByTable: async (tableId: string) =>
      (await db
        .selectFrom("waiter_calls")
        .select("id")
        .where("table_id", "=", tableId)
        .where("status", "=", "open")
        .limit(1)
        .executeTakeFirst()) ?? null,

    listOpen: async () =>
      db
        .selectFrom("waiter_calls")
        .select(["id", "table_id", "created_at"])
        .where("status", "=", "open")
        .orderBy("created_at")
        .execute(),

    create: async (row: Insertable<WaiterCallsTable>) => {
      await db.insertInto("waiter_calls").values(row).execute();
    },

    ack: async (id: string, ackedAt: string, ackedBy: string | null) => {
      await db
        .updateTable("waiter_calls")
        .set({ status: "done", acked_at: ackedAt, acked_by: ackedBy })
        .where("id", "=", id)
        .execute();
    },
  };
}
