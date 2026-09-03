import type { Kysely, Updateable } from "kysely";
import type { DB, OutletsTable } from "../db/types.js";

export class OutletSlugConflictError extends Error {
  constructor() {
    super("outlet slug already in use");
    this.name = "OutletSlugConflictError";
  }
}

// findFirst remains for bootstrap/public flows. Staff-scoped operations must
// use an explicit outlet id.
export function makeOutletsRepo(db: Kysely<DB>) {
  return {
    findFirst: async () =>
      (await db
        .selectFrom("outlets")
        .selectAll()
        .where("active", "=", true)
        .limit(1)
        .executeTakeFirst()) ?? null,

    listActive: async () =>
      db
        .selectFrom("outlets")
        .select(["id", "name", "slug"])
        .where("active", "=", true)
        .orderBy("name")
        .execute(),
    findActiveById: async (id: string) =>
      (await db
        .selectFrom("outlets")
        .selectAll()
        .where("id", "=", id)
        .where("active", "=", true)
        .executeTakeFirst()) ?? null,
    findActiveBySlug: async (slug: string) =>
      (await db
        .selectFrom("outlets")
        .selectAll()
        .where("slug", "=", slug)
        .where("active", "=", true)
        .executeTakeFirst()) ?? null,

    findById: async (id: string) =>
      (await db.selectFrom("outlets").selectAll().where("id", "=", id).executeTakeFirst()) ?? null,

    // computeBill only needs the bill header fields
    findBillingConfig: async (outletId: string) =>
      (await db
        .selectFrom("outlets")
        .select(["id", "name", "service_charge_pct", "gstin"])
        .where("id", "=", outletId)
        .limit(1)
        .executeTakeFirst()) ?? null,

    findApiKeys: async (outletId: string) =>
      (await db
        .selectFrom("outlets")
        .select(["gemini_api_key", "sarvam_api_key"])
        .where("id", "=", outletId)
        .limit(1)
        .executeTakeFirst()) ?? null,

    findBillSeq: async (id: string) =>
      (await db.selectFrom("outlets").select("bill_seq").where("id", "=", id).executeTakeFirst()) ??
      null,

    setBillSeq: async (id: string, seq: number) => {
      await db.updateTable("outlets").set({ bill_seq: seq }).where("id", "=", id).execute();
    },

    update: async (id: string, patch: Updateable<OutletsTable>) => {
      try {
        await db.updateTable("outlets").set(patch).where("id", "=", id).execute();
      } catch (error) {
        if ((error as { code?: string })?.code === "23505" && "slug" in patch) {
          throw new OutletSlugConflictError();
        }
        throw error;
      }
    },
  };
}
