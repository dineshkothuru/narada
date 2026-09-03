import type { Insertable, Kysely } from "kysely";
import type { DB, OrderItemsTable } from "../db/types.js";

export function makeOrderItemsRepo(db: Kysely<DB>) {
  return {
    createMany: async (rows: Insertable<OrderItemsTable>[]) => {
      if (rows.length === 0) return;
      await db.insertInto("order_items").values(rows).execute();
    },

    findOrderId: async (id: string) =>
      (await db
        .selectFrom("order_items")
        .select("order_id")
        .where("id", "=", id)
        .executeTakeFirst()) ?? null,

    setStatus: async (id: string, status: string) => {
      await db.updateTable("order_items").set({ status }).where("id", "=", id).execute();
    },

    // the sibling statuses that deriveOrderStatus() folds into a ticket status
    listStatusesByOrder: async (orderId: string) =>
      db.selectFrom("order_items").select("status").where("order_id", "=", orderId).execute(),

    // a whole-ticket advance drags every dish along with it
    setStatusByOrder: async (orderId: string, status: string) => {
      await db.updateTable("order_items").set({ status }).where("order_id", "=", orderId).execute();
    },

    // "start cooking" only moves dishes nobody has touched yet
    setStatusByOrderWhere: async (orderId: string, fromStatus: string, status: string) => {
      await db
        .updateTable("order_items")
        .set({ status })
        .where("order_id", "=", orderId)
        .where("status", "=", fromStatus)
        .execute();
    },
  };
}
