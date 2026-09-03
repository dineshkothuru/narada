import type { Kysely, Updateable } from "kysely";
import type { DB, OutletsTable } from "../db/types.js";

// Single-tenant for now: most callers want "the" outlet, which the legacy
// routes expressed as `outlets?select=...&limit=1`. findFirst keeps that
// shape rather than pretending a tenant id is threaded through.
export function makeOutletsRepo(db: Kysely<DB>) {
  return {
    findFirst: async () =>
      (await db.selectFrom("outlets").selectAll().limit(1).executeTakeFirst()) ?? null,

    findById: async (id: string) =>
      (await db.selectFrom("outlets").selectAll().where("id", "=", id).executeTakeFirst()) ?? null,

    // computeBill only needs the bill header fields
    findBillingConfig: async () =>
      (await db
        .selectFrom("outlets")
        .select(["id", "name", "service_charge_pct", "gstin"])
        .limit(1)
        .executeTakeFirst()) ?? null,

    findApiKeys: async () =>
      (await db
        .selectFrom("outlets")
        .select(["gemini_api_key", "sarvam_api_key"])
        .limit(1)
        .executeTakeFirst()) ?? null,

    findBillSeq: async (id: string) =>
      (await db.selectFrom("outlets").select("bill_seq").where("id", "=", id).executeTakeFirst()) ??
      null,

    setBillSeq: async (id: string, seq: number) => {
      await db.updateTable("outlets").set({ bill_seq: seq }).where("id", "=", id).execute();
    },

    update: async (id: string, patch: Updateable<OutletsTable>) => {
      await db.updateTable("outlets").set(patch).where("id", "=", id).execute();
    },
  };
}
