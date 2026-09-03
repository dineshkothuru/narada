import type { Insertable, Kysely } from "kysely";
import { deriveOrderStatus } from "@narada/shared";
import type { DB, OrderItemsTable } from "../db/types.js";

export function makeOrderItemsRepo(db: Kysely<DB>) {
  return {
    createMany: async (rows: Insertable<OrderItemsTable>[]) => {
      if (rows.length === 0) return;
      await db.insertInto("order_items").values(rows).execute();
    },

    findOrderId: async (id: string, outletId: string) => {
      return (
        (await db
          .selectFrom("order_items")
          .innerJoin("orders", "orders.id", "order_items.order_id")
          .select("order_items.order_id")
          .where("order_items.id", "=", id)
          .where("orders.outlet_id", "=", outletId)
          .executeTakeFirst()) ?? null
      );
    },

    findForServing: async (id: string, outletId: string) =>
      (await db
        .selectFrom("order_items")
        .innerJoin("orders", "orders.id", "order_items.order_id")
        .select(["order_items.order_id", "order_items.status"])
        .where("order_items.id", "=", id)
        .where("orders.outlet_id", "=", outletId)
        .executeTakeFirst()) ?? null,

    // Cancellation reads the complete ownership chain in one query. A caller
    // must prove outlet ownership before it can mutate an item.
    findForCancellation: async (id: string, outletId: string) =>
      (await db
        .selectFrom("order_items")
        .innerJoin("orders", "orders.id", "order_items.order_id")
        .innerJoin("sessions", "sessions.id", "orders.session_id")
        .select([
          "order_items.id",
          "order_items.name",
          "order_items.status",
          "order_items.order_id",
          "orders.status as order_status",
          "sessions.id as session_id",
          "sessions.table_id",
          "sessions.outlet_id",
          "sessions.bill_no",
        ])
        .where("order_items.id", "=", id)
        .where("orders.outlet_id", "=", outletId)
        .where("sessions.outlet_id", "=", outletId)
        .executeTakeFirst()) ?? null,

    cancel: async (
      id: string,
      cancelledBy: string,
      outletId: string,
      options?: { sessionId?: string; statuses?: readonly string[] },
    ) => {
      return db.transaction().execute(async (tx) => {
        const initial = await tx
          .selectFrom("order_items")
          .innerJoin("orders", "orders.id", "order_items.order_id")
          .innerJoin("sessions", "sessions.id", "orders.session_id")
          .select(["sessions.id as session_id", "sessions.merged_into"])
          .where("order_items.id", "=", id)
          .where("orders.outlet_id", "=", outletId)
          .where("sessions.outlet_id", "=", outletId)
          .executeTakeFirst();
        if (!initial) return null;
        const ids = [initial.session_id, initial.merged_into].filter(Boolean).sort();
        for (const sessionId of ids) {
          await tx
            .selectFrom("sessions")
            .select("id")
            .where("id", "=", sessionId)
            .where("outlet_id", "=", outletId)
            .forUpdate()
            .executeTakeFirst();
        }
        const owner = await tx
          .selectFrom("order_items")
          .innerJoin("orders", "orders.id", "order_items.order_id")
          .innerJoin("sessions", "sessions.id", "orders.session_id")
          .select([
            "sessions.id as session_id",
            "sessions.bill_no",
            "sessions.merged_into",
            "orders.id as order_id",
          ])
          .where("order_items.id", "=", id)
          .where("orders.outlet_id", "=", outletId)
          .where("sessions.outlet_id", "=", outletId)
          .forUpdate()
          .executeTakeFirst();
        if (
          !owner ||
          owner.bill_no !== null ||
          (options?.sessionId !== undefined && owner.session_id !== options.sessionId)
        )
          return null;
        if (owner.merged_into) {
          const primary = await tx
            .selectFrom("sessions")
            .select(["id", "bill_no"])
            .where("id", "=", owner.merged_into)
            .where("outlet_id", "=", outletId)
            .forUpdate()
            .executeTakeFirst();
          if (!primary || primary.bill_no) return null;
        }

        let query = tx
          .updateTable("order_items")
          .set({
            status: "cancelled",
            cancelled_at: new Date().toISOString(),
            cancelled_by: cancelledBy.slice(0, 60),
          })
          .where("id", "=", id);
        if (options?.statuses?.length) query = query.where("status", "in", options.statuses);
        const cancelled = await query.returning(["id", "name"]).executeTakeFirst();
        if (!cancelled) return null;
        const siblings = await tx
          .selectFrom("order_items")
          .select("status")
          .where("order_id", "=", owner.order_id)
          .execute();
        const orderStatus = deriveOrderStatus(siblings);
        await tx
          .updateTable("orders")
          .set({ status: orderStatus })
          .where("id", "=", owner.order_id)
          .where("outlet_id", "=", outletId)
          .execute();
        return {
          ...cancelled,
          orderStatus,
          orderCancelled: orderStatus === "cancelled",
        };
      });
    },

    markServed: async (id: string, outletId: string) => {
      const query = db
        .updateTable("order_items")
        .set({ status: "served" })
        .where("id", "=", id)
        .where(
          "order_id",
          "in",
          db.selectFrom("orders").select("id").where("outlet_id", "=", outletId),
        );
      return (await query.returning("id").executeTakeFirst()) ?? null;
    },

    setStatus: async (id: string, status: string, outletId: string) => {
      let query = db.updateTable("order_items").set({ status }).where("id", "=", id);
      query = query.where("status", "!=", "cancelled");
      query = query.where(
        "order_id",
        "in",
        db.selectFrom("orders").select("id").where("outlet_id", "=", outletId),
      );
      return (await query.returning("id").executeTakeFirst()) ?? null;
    },

    // the sibling statuses that deriveOrderStatus() folds into a ticket status
    listStatusesByOrder: async (orderId: string, outletId: string) => {
      let query = db.selectFrom("order_items").select("status").where("order_id", "=", orderId);
      query = query.where(
        "order_id",
        "in",
        db.selectFrom("orders").select("id").where("outlet_id", "=", outletId),
      );
      return query.execute();
    },

    // a whole-ticket advance drags every dish along with it
    setStatusByOrder: async (orderId: string, status: string, outletId: string) => {
      let query = db.updateTable("order_items").set({ status }).where("order_id", "=", orderId);
      query = query.where("status", "!=", "cancelled");
      query = query.where(
        "order_id",
        "in",
        db.selectFrom("orders").select("id").where("outlet_id", "=", outletId),
      );
      await query.execute();
    },

    // "start cooking" only moves dishes nobody has touched yet
    setStatusByOrderWhere: async (
      orderId: string,
      fromStatus: string,
      status: string,
      outletId: string,
    ) => {
      let query = db
        .updateTable("order_items")
        .set({ status })
        .where("order_id", "=", orderId)
        .where("status", "=", fromStatus);
      query = query.where(
        "order_id",
        "in",
        db.selectFrom("orders").select("id").where("outlet_id", "=", outletId),
      );
      await query.execute();
    },
  };
}
