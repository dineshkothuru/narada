import type { Insertable, Kysely } from "kysely";
import type { AuditLogTable, DB } from "../db/types.js";

export type AuditInput = Omit<Insertable<AuditLogTable>, "id" | "created_at">;

export function makeAuditRepo(db: Kysely<DB>) {
  return {
    create: async (entry: AuditInput) =>
      db.insertInto("audit_log").values(entry).returningAll().executeTakeFirstOrThrow(),

    listRecent: (outletId: string, limit = 12) =>
      db
        .selectFrom("audit_log")
        .selectAll()
        .where("outlet_id", "=", outletId)
        .orderBy("created_at", "desc")
        .limit(limit)
        .execute(),

    listByActions: (outletId: string, actions: string[], limit = 12) => {
      if (actions.length === 0) return Promise.resolve([]);
      return db
        .selectFrom("audit_log")
        .selectAll()
        .where("outlet_id", "=", outletId)
        .where("action", "in", actions)
        .orderBy("created_at", "desc")
        .limit(limit)
        .execute();
    },
  };
}
