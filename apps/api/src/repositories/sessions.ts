import type { Insertable, Kysely, Updateable } from "kysely";
import { jsonArrayFrom, jsonObjectFrom } from "kysely/helpers/postgres";
import type { DB, SessionsTable } from "../db/types.js";

// The claim* functions below are conditional updates: they carry the
// precondition into the WHERE clause and return null when it no longer holds.
// That is what makes the reward wheel, the comp prize and table assignment
// safe against two phones tapping at the same instant — the database decides
// the winner, not a read-then-write in application code.
export function makeSessionsRepo(db: Kysely<DB>) {
  return {
    findById: async (id: string) =>
      (await db.selectFrom("sessions").selectAll().where("id", "=", id).executeTakeFirst()) ?? null,

    findActiveByTableId: async (tableId: string) =>
      (await db
        .selectFrom("sessions")
        .selectAll()
        .where("table_id", "=", tableId)
        .where("status", "=", "active")
        .orderBy("created_at", "desc")
        .limit(1)
        .executeTakeFirst()) ?? null,

    create: async (row: Insertable<SessionsTable>) =>
      db.insertInto("sessions").values(row).returningAll().executeTakeFirstOrThrow(),

    update: async (id: string, patch: Updateable<SessionsTable>) => {
      await db.updateTable("sessions").set(patch).where("id", "=", id).execute();
    },

    // does this session belong to that table? guards the customer bill PATCH
    findOwnedByTable: async (id: string, tableId: string) =>
      (await db
        .selectFrom("sessions")
        .select("id")
        .where("id", "=", id)
        .where("table_id", "=", tableId)
        .executeTakeFirst()) ?? null,

    // ---- conditional claims -------------------------------------------------

    // wins only if nobody else has set a discount meanwhile
    claimDiscount: async (id: string, pct: number) =>
      (await db
        .updateTable("sessions")
        .set({ discount_pct: pct })
        .where("id", "=", id)
        .where("discount_pct", "=", 0)
        .returning("discount_pct")
        .executeTakeFirst()) ?? null,

    // the comp flag is claimed BEFORE the free dish is created, so a lost race
    // never mints a second ticket
    claimComp: async (id: string) =>
      (await db
        .updateTable("sessions")
        .set({ comp_awarded: true })
        .where("id", "=", id)
        .where("comp_awarded", "=", false)
        .returning("id")
        .executeTakeFirst()) ?? null,

    // whoever attends the call takes the table, but never steals one that
    // somebody has already claimed
    claimWaiter: async (id: string, waiterId: string) =>
      (await db
        .updateTable("sessions")
        .set({ attendant: waiterId })
        .where("id", "=", id)
        .where("attendant", "is", null)
        .returning(["id", "attendant"])
        .executeTakeFirst()) ?? null,

    // ---- reads for the staff screens ---------------------------------------

    // computeBill's embedded select: sessions -> table, orders -> items,
    // payments. Kept as ONE query with jsonObjectFrom/jsonArrayFrom, which is
    // the faithful translation of the PostgREST resource embedding and avoids
    // three round trips per table on a floor refresh.
    findForBilling: async (id: string) =>
      (await db
        .selectFrom("sessions")
        .select((eb) => [
          "sessions.id",
          "sessions.status",
          "sessions.discount_pct",
          "sessions.service_waived",
          "sessions.bill_no",
          "sessions.bill_tip",
          "sessions.settled_at",
          "sessions.outlet_id",
          "sessions.attendant",
          jsonObjectFrom(
            eb
              .selectFrom("tables")
              .select("tables.label")
              .whereRef("tables.id", "=", "sessions.table_id"),
          ).as("table"),
          jsonArrayFrom(
            eb
              .selectFrom("orders")
              .select((eb2) => [
                "orders.status",
                jsonArrayFrom(
                  eb2
                    .selectFrom("order_items")
                    .select([
                      "order_items.name",
                      "order_items.qty",
                      "order_items.unit_price",
                      "order_items.gst_pct",
                    ])
                    .whereRef("order_items.order_id", "=", "orders.id"),
                ).as("items"),
              ])
              .whereRef("orders.session_id", "=", "sessions.id"),
          ).as("orders"),
          jsonArrayFrom(
            eb
              .selectFrom("payments")
              .select(["payments.amount_inr", "payments.status"])
              .whereRef("payments.session_id", "=", "sessions.id"),
          ).as("payments"),
        ])
        .where("sessions.id", "=", id)
        .executeTakeFirst()) ?? null,

    // the waiter board: every active session with its rounds and payments
    listActiveForWaiter: async () =>
      db
        .selectFrom("sessions")
        .select((eb) => [
          "sessions.id",
          "sessions.table_id",
          "sessions.created_at",
          "sessions.discount_pct",
          "sessions.guests",
          "sessions.attendant",
          "sessions.bill_no",
          jsonArrayFrom(
            eb
              .selectFrom("orders")
              .select((eb2) => [
                "orders.id",
                "orders.status",
                "orders.total_inr",
                "orders.created_at",
                "orders.lang",
                jsonArrayFrom(
                  eb2
                    .selectFrom("order_items")
                    .select(["order_items.name", "order_items.qty"])
                    .whereRef("order_items.order_id", "=", "orders.id"),
                ).as("items"),
              ])
              .whereRef("orders.session_id", "=", "sessions.id"),
          ).as("orders"),
          jsonArrayFrom(
            eb
              .selectFrom("payments")
              .select(["payments.amount_inr", "payments.status"])
              .whereRef("payments.session_id", "=", "sessions.id"),
          ).as("payments"),
        ])
        .where("sessions.status", "=", "active")
        .execute(),

    // the floor board: lighter — no items, no payments
    listActiveForFloor: async () =>
      db
        .selectFrom("sessions")
        .select((eb) => [
          "sessions.id",
          "sessions.table_id",
          "sessions.created_at",
          "sessions.guests",
          "sessions.merged_into",
          "sessions.attendant",
          "sessions.bill_no",
          jsonArrayFrom(
            eb
              .selectFrom("orders")
              .select(["orders.id", "orders.status", "orders.total_inr", "orders.lang"])
              .whereRef("orders.session_id", "=", "sessions.id"),
          ).as("orders"),
        ])
        .where("sessions.status", "=", "active")
        .execute(),

    // the counter board: rounds only, to count what is still unserved
    listActiveForCounter: async () =>
      db
        .selectFrom("sessions")
        .select((eb) => [
          "sessions.id",
          "sessions.table_id",
          "sessions.created_at",
          "sessions.attendant",
          "sessions.merged_into",
          "sessions.bill_no",
          jsonArrayFrom(
            eb
              .selectFrom("orders")
              .select(["orders.id", "orders.status", "orders.total_inr"])
              .whereRef("orders.session_id", "=", "sessions.id"),
          ).as("orders"),
        ])
        .where("sessions.status", "=", "active")
        .execute(),

    // ---- settlement ---------------------------------------------------------

    close: async (id: string, closedAt: string) => {
      await db
        .updateTable("sessions")
        .set({ status: "closed", closed_at: closedAt })
        .where("id", "=", id)
        .execute();
    },

    listActiveMergedInto: async (primaryId: string) =>
      db
        .selectFrom("sessions")
        .select(["id", "table_id"])
        .where("merged_into", "=", primaryId)
        .where("status", "=", "active")
        .execute(),

    // paying the primary closes the whole merged group in one statement
    closeMergedInto: async (primaryId: string, closedAt: string) => {
      await db
        .updateTable("sessions")
        .set({ status: "closed", closed_at: closedAt })
        .where("merged_into", "=", primaryId)
        .where("status", "=", "active")
        .execute();
    },

    // tips are tallied off the frozen bill rows, not the live totals
    listSettledSince: async (since: string) =>
      db
        .selectFrom("sessions")
        .select(["tip_to", "bill_tip", "settled_at"])
        .where("settled_at", ">=", since)
        .execute(),
  };
}
