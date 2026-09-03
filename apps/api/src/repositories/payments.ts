import type { Insertable, Kysely } from "kysely";
import type { DB, PaymentsTable } from "../db/types.js";

export function makePaymentsRepo(db: Kysely<DB>) {
  return {
    create: async (row: Insertable<PaymentsTable>) => {
      await db.insertInto("payments").values(row).execute();
    },

    listBySession: async (sessionId: string) =>
      db
        .selectFrom("payments")
        .select(["amount_inr", "status", "method"])
        .where("session_id", "=", sessionId)
        .execute(),
  };
}
