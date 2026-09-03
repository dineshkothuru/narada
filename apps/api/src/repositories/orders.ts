import type { Insertable, Kysely } from "kysely";
import { jsonArrayFrom, jsonObjectFrom } from "kysely/helpers/postgres";
import type { DB, OrdersTable } from "../db/types.js";

export function makeOrdersRepo(db: Kysely<DB>) {
  return {
    create: async (row: Insertable<OrdersTable>) =>
      db.insertInto("orders").values(row).returningAll().executeTakeFirstOrThrow(),

    findStatus: async (id: string) =>
      (await db.selectFrom("orders").select("status").where("id", "=", id).executeTakeFirst()) ??
      null,

    setStatus: async (id: string, status: string) => {
      await db.updateTable("orders").set({ status }).where("id", "=", id).execute();
    },

    // does this session have any round at all? gates the comp prize
    existsForSession: async (sessionId: string) =>
      (await db
        .selectFrom("orders")
        .select("id")
        .where("session_id", "=", sessionId)
        .limit(1)
        .executeTakeFirst()) !== undefined,

    // the customer's live order view, and sessionRounds() behind it
    listBySessionWithItems: async (sessionId: string) =>
      db
        .selectFrom("orders")
        .select((eb) => [
          "orders.id",
          "orders.status",
          "orders.total_inr",
          "orders.created_at",
          "orders.placed_by",
          "orders.placed_via",
          jsonArrayFrom(
            eb
              .selectFrom("order_items")
              .select([
                "order_items.id",
                "order_items.name",
                "order_items.qty",
                "order_items.status",
              ])
              .whereRef("order_items.order_id", "=", "orders.id"),
          ).as("items"),
        ])
        .where("orders.session_id", "=", sessionId)
        .orderBy("orders.created_at")
        .execute(),

    // the kitchen rail: open tickets, newest first, with the table label
    listForKitchen: async (limit = 60) =>
      db
        .selectFrom("orders")
        .select((eb) => [
          "orders.id",
          "orders.status",
          "orders.total_inr",
          "orders.placed_via",
          "orders.created_at",
          "orders.lang",
          jsonObjectFrom(
            eb
              .selectFrom("sessions")
              .select((eb2) => [
                jsonObjectFrom(
                  eb2
                    .selectFrom("tables")
                    .select("tables.label")
                    .whereRef("tables.id", "=", "sessions.table_id"),
                ).as("table"),
              ])
              .whereRef("sessions.id", "=", "orders.session_id"),
          ).as("session"),
          jsonArrayFrom(
            eb
              .selectFrom("order_items")
              .select([
                "order_items.id",
                "order_items.name",
                "order_items.qty",
                "order_items.notes",
                "order_items.status",
              ])
              .whereRef("order_items.order_id", "=", "orders.id"),
          ).as("items"),
        ])
        .where("orders.status", "in", ["placed", "preparing", "ready", "served"])
        .orderBy("orders.created_at", "desc")
        .limit(limit)
        .execute(),

    // the owner's order log: order -> session -> table + payments, and items
    listForAdmin: async (since: string | null, limit = 300) => {
      let query = db
        .selectFrom("orders")
        .select((eb) => [
          "orders.id",
          "orders.status",
          "orders.total_inr",
          "orders.placed_via",
          "orders.placed_by",
          "orders.created_at",
          jsonObjectFrom(
            eb
              .selectFrom("sessions")
              .select((eb2) => [
                "sessions.id",
                "sessions.status",
                "sessions.discount_pct",
                jsonObjectFrom(
                  eb2
                    .selectFrom("tables")
                    .select("tables.label")
                    .whereRef("tables.id", "=", "sessions.table_id"),
                ).as("table"),
                jsonArrayFrom(
                  eb2
                    .selectFrom("payments")
                    .select(["payments.amount_inr", "payments.status", "payments.method"])
                    .whereRef("payments.session_id", "=", "sessions.id"),
                ).as("payments"),
              ])
              .whereRef("sessions.id", "=", "orders.session_id"),
          ).as("session"),
          jsonArrayFrom(
            eb
              .selectFrom("order_items")
              .select([
                "order_items.name",
                "order_items.qty",
                "order_items.unit_price",
                "order_items.status",
              ])
              .whereRef("order_items.order_id", "=", "orders.id"),
          ).as("items"),
        ])
        .orderBy("orders.created_at", "desc")
        .limit(limit);
      if (since) query = query.where("orders.created_at", ">=", since);
      return query.execute();
    },
  };
}
