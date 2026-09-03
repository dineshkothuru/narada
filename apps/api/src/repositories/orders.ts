import type { Insertable, Kysely } from "kysely";
import { jsonArrayFrom, jsonObjectFrom } from "kysely/helpers/postgres";
import type { DB, OrderItemsTable, OrdersTable } from "../db/types.js";

export function makeOrdersRepo(db: Kysely<DB>) {
  return {
    create: async (row: Insertable<OrdersTable>) =>
      db.insertInto("orders").values(row).returningAll().executeTakeFirstOrThrow(),

    // Keep the session lock through both inserts. Once bill finalization has
    // committed its bill_no, this guard also prevents a post-bill order.
    createWithItems: async (
      row: Insertable<OrdersTable>,
      items: Omit<Insertable<OrderItemsTable>, "order_id">[],
      outletId: string,
    ) =>
      db.transaction().execute(async (tx) => {
        const initial = await tx
          .selectFrom("sessions")
          .select(["id", "merged_into", "status", "bill_no"])
          .where("id", "=", row.session_id)
          .where("outlet_id", "=", outletId)
          .executeTakeFirst();
        if (!initial || initial.status !== "active" || initial.bill_no) return null;
        const ids = [initial.id, initial.merged_into].filter(Boolean).sort();
        for (const id of ids) {
          await tx
            .selectFrom("sessions")
            .select(["id"])
            .where("id", "=", id)
            .where("outlet_id", "=", outletId)
            .forUpdate()
            .executeTakeFirst();
        }
        const session = await tx
          .selectFrom("sessions")
          .select(["id", "merged_into", "status", "bill_no"])
          .where("id", "=", row.session_id)
          .where("outlet_id", "=", outletId)
          .executeTakeFirst();
        if (!session || session.status !== "active" || session.bill_no) return null;
        if (session.merged_into) {
          const primary = await tx
            .selectFrom("sessions")
            .select(["status", "bill_no"])
            .where("id", "=", session.merged_into)
            .where("outlet_id", "=", outletId)
            .executeTakeFirst();
          if (!primary || primary.status !== "active" || primary.bill_no) return null;
        }
        const order = await tx
          .insertInto("orders")
          .values(row)
          .returningAll()
          .executeTakeFirstOrThrow();
        if (items.length > 0)
          await tx
            .insertInto("order_items")
            .values(items.map((item) => ({ ...item, order_id: order.id })))
            .execute();
        return order;
      }),

    findStatus: async (id: string, outletId: string) => {
      let query = db.selectFrom("orders").select("status").where("id", "=", id);
      query = query.where("outlet_id", "=", outletId);
      return (await query.executeTakeFirst()) ?? null;
    },

    lockForItemStatus: async (id: string, outletId: string) =>
      (await db
        .selectFrom("orders")
        .select("id")
        .where("id", "=", id)
        .where("outlet_id", "=", outletId)
        .forUpdate()
        .executeTakeFirst()) ?? null,

    findStatusForSession: async (id: string, sessionId: string, outletId: string) =>
      (await db
        .selectFrom("orders")
        .select("status")
        .where("id", "=", id)
        .where("session_id", "=", sessionId)
        .where("outlet_id", "=", outletId)
        .executeTakeFirst()) ?? null,

    // Prove anonymous order ownership through the order -> session -> table join.
    findStatusForTable: async (id: string, tableId: string, outletId: string) => {
      let query = db
        .selectFrom("orders")
        .innerJoin("sessions", "sessions.id", "orders.session_id")
        .select("orders.status")
        .where("orders.id", "=", id)
        .where("sessions.table_id", "=", tableId);
      query = query
        .where("orders.outlet_id", "=", outletId)
        .where("sessions.outlet_id", "=", outletId);
      return (await query.executeTakeFirst()) ?? null;
    },

    setStatus: async (id: string, status: string, outletId: string) => {
      let query = db.updateTable("orders").set({ status }).where("id", "=", id);
      query = query.where("outlet_id", "=", outletId);
      await query.execute();
    },

    // does this session have any round at all? gates the comp prize
    existsForSession: async (sessionId: string, outletId: string) => {
      const query = db
        .selectFrom("orders")
        .select("id")
        .where(
          "session_id",
          "in",
          db
            .selectFrom("sessions")
            .select("sessions.id")
            .where("sessions.outlet_id", "=", outletId)
            .where((eb) =>
              eb.or([
                eb("sessions.id", "=", sessionId),
                eb("sessions.merged_into", "=", sessionId),
              ]),
            ),
        )
        .where("outlet_id", "=", outletId)
        .limit(1);
      return (await query.executeTakeFirst()) !== undefined;
    },

    hasLiveForSession: async (sessionId: string, outletId: string) => {
      const query = db
        .selectFrom("orders")
        .select("id")
        .where("session_id", "=", sessionId)
        .where("status", "!=", "cancelled")
        .where("outlet_id", "=", outletId)
        .limit(1);
      return (await query.executeTakeFirst()) !== undefined;
    },

    // the customer's live order view, and sessionRounds() behind it
    listBySessionWithItems: async (sessionId: string, outletId: string) => {
      let query = db
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
        .where(
          "orders.session_id",
          "in",
          db
            .selectFrom("sessions")
            .select("sessions.id")
            .where("sessions.outlet_id", "=", outletId)
            .where((eb) =>
              eb.or([
                eb("sessions.id", "=", sessionId),
                eb("sessions.merged_into", "=", sessionId),
              ]),
            ),
        )
        .orderBy("orders.created_at");
      query = query.where("orders.outlet_id", "=", outletId);
      return query.execute();
    },

    // the kitchen rail: open tickets, newest first, with the table label
    listForKitchen: async (limit = 60, outletId: string) => {
      let query = db
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
        .limit(limit);
      query = query.where("orders.outlet_id", "=", outletId);
      return query.execute();
    },

    // the owner's order log: order -> session -> table + payments, and items
    listForAdmin: async (since: string | null, limit = 300, outletId: string) => {
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
      query = query.where("orders.outlet_id", "=", outletId);
      return query.execute();
    },

    // Printable KOT data, scoped through both order and session outlet ids.
    findForKot: async (id: string, outletId: string) =>
      (await db
        .selectFrom("orders")
        .innerJoin("sessions", "sessions.id", "orders.session_id")
        .select((eb) => [
          "orders.id",
          "orders.created_at",
          "orders.placed_by",
          "orders.status",
          "orders.total_inr",
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
                "order_items.name",
                "order_items.qty",
                "order_items.notes",
                "order_items.status",
              ])
              .whereRef("order_items.order_id", "=", "orders.id"),
          ).as("items"),
        ])
        .where("orders.id", "=", id)
        .where("orders.outlet_id", "=", outletId)
        .where("sessions.outlet_id", "=", outletId)
        .executeTakeFirst()) ?? null,
  };
}
