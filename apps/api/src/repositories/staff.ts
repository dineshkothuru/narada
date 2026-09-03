import type { Insertable, Kysely } from "kysely";
import type { DB, StaffTable } from "../db/types.js";

export function makeStaffRepo(db: Kysely<DB>) {
  return {
    // login pulls every active PIN and compares in-process in constant time —
    // filtering by PIN in the query would leak timing and log the secret
    listActiveWithPins: async () =>
      db.selectFrom("staff").select(["role", "name", "pin"]).where("active", "=", true).execute(),

    listAll: async () =>
      db
        .selectFrom("staff")
        .select(["id", "name", "role", "pin", "active", "created_at"])
        .orderBy("created_at")
        .execute(),

    create: async (row: Insertable<StaffTable>) => {
      await db.insertInto("staff").values(row).execute();
    },

    setActive: async (id: string, active: boolean) => {
      await db.updateTable("staff").set({ active }).where("id", "=", id).execute();
    },

    remove: async (id: string) => {
      await db.deleteFrom("staff").where("id", "=", id).execute();
    },
  };
}
