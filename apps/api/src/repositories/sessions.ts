import type { Insertable, Kysely, Updateable } from "kysely";
import { jsonArrayFrom, jsonObjectFrom } from "kysely/helpers/postgres";
import type { DB, SessionsTable } from "../db/types.js";

// The claim* functions below are conditional updates: they carry the
// precondition into the WHERE clause and return null when it no longer holds.
// That is what makes the reward wheel, the comp prize and table assignment
// safe against two phones tapping at the same instant — the database decides
// the winner, not a read-then-write in application code.
export function makeSessionsRepo(db: Kysely<DB>) {
  const finalizeBillOn = async (
    runner: Kysely<DB>,
    id: string,
    patch: Updateable<SessionsTable>,
    outletId: string,
    datePart: string,
    freezeTipToAttendant: boolean,
  ) => {
    const session = await runner
      .selectFrom("sessions")
      .select(["id", "bill_no", "attendant"])
      .where("id", "=", id)
      .where("outlet_id", "=", outletId)
      .where("status", "=", "active")
      .forUpdate()
      .executeTakeFirst();
    if (!session || session.bill_no) return null;
    const outlet = await runner
      .selectFrom("outlets")
      .select("bill_seq")
      .where("id", "=", outletId)
      .forUpdate()
      .executeTakeFirst();
    if (!outlet) return null;
    const seq = Number(outlet.bill_seq ?? 0) + 1;
    const billNo = `NAR-${datePart}-${String(seq).padStart(4, "0")}`;
    await runner.updateTable("outlets").set({ bill_seq: seq }).where("id", "=", outletId).execute();
    const updated = await runner
      .updateTable("sessions")
      .set({
        ...patch,
        bill_no: billNo,
        tip_to: freezeTipToAttendant ? (session.attendant ?? null) : null,
      })
      .where("id", "=", id)
      .where("outlet_id", "=", outletId)
      .where("bill_no", "is", null)
      .returning("id")
      .executeTakeFirst();
    return updated ? { billNo } : null;
  };

  return {
    findPrimaryId: async (id: string, outletId: string) => {
      const row = await db
        .selectFrom("sessions")
        .select("merged_into")
        .where("id", "=", id)
        .where("outlet_id", "=", outletId)
        .executeTakeFirst();
      return row ? (row.merged_into ?? id) : null;
    },
    // Lock every member of a billing group in deterministic order. The bill
    // snapshot must be a separate statement after this lock: PostgreSQL's
    // READ COMMITTED snapshot for a SELECT ... FOR UPDATE can otherwise be
    // older than a writer that committed while the lock was being acquired.
    lockBillingGroup: async (id: string, outletId: string) => {
      await db
        .selectFrom("sessions")
        .select("id")
        .where("outlet_id", "=", outletId)
        .where((eb) => eb.or([eb("id", "=", id), eb("merged_into", "=", id)]))
        .orderBy("id")
        .forUpdate()
        .execute();
    },
    findById: async (id: string, outletId: string) => {
      let query = db.selectFrom("sessions").selectAll().where("id", "=", id);
      query = query.where("outlet_id", "=", outletId);
      return (await query.executeTakeFirst()) ?? null;
    },

    findActiveByTableId: async (tableId: string, outletId: string) => {
      let query = db
        .selectFrom("sessions")
        .selectAll()
        .where("table_id", "=", tableId)
        .where("status", "=", "active")
        .orderBy("created_at", "desc")
        .limit(1);
      query = query.where("outlet_id", "=", outletId);
      return (await query.executeTakeFirst()) ?? null;
    },

    create: async (row: Insertable<SessionsTable>) =>
      db.insertInto("sessions").values(row).returningAll().executeTakeFirstOrThrow(),

    update: async (id: string, patch: Updateable<SessionsTable>, outletId: string) => {
      let query = db.updateTable("sessions").set(patch).where("id", "=", id);
      query = query.where("outlet_id", "=", outletId);
      await query.execute();
    },

    updateIfUnbilled: async (id: string, patch: Updateable<SessionsTable>, outletId: string) => {
      const query = db
        .updateTable("sessions")
        .set(patch)
        .where("id", "=", id)
        .where("outlet_id", "=", outletId)
        .where("bill_no", "is", null);
      return (await query.returning("id").executeTakeFirst()) !== undefined;
    },

    mergeIfActiveUnbilled: async (sessionId: string, targetId: string, outletId: string) =>
      db.transaction().execute(async (tx) => {
        const source = await tx
          .selectFrom("sessions")
          .select(["id", "merged_into"])
          .where("id", "=", sessionId)
          .where("outlet_id", "=", outletId)
          .executeTakeFirst();
        const target = await tx
          .selectFrom("sessions")
          .select(["id", "merged_into"])
          .where("id", "=", targetId)
          .where("outlet_id", "=", outletId)
          .executeTakeFirst();
        if (!source || !target) return false;
        const ids = [
          ...new Set([sessionId, targetId, source.merged_into, target.merged_into].filter(Boolean)),
        ].sort();
        for (const id of ids) {
          const row = await tx
            .selectFrom("sessions")
            .select(["id", "status", "bill_no", "merged_into", "service_type", "table_id"])
            .where("id", "=", id)
            .where("outlet_id", "=", outletId)
            .forUpdate()
            .executeTakeFirst();
          if (
            !row ||
            row.status !== "active" ||
            row.bill_no ||
            row.service_type !== "dine_in" ||
            !row.table_id
          )
            return false;
        }
        const currentPrimary = source.merged_into;
        if (currentPrimary === targetId || target.merged_into) return false;
        if (currentPrimary) {
          const primary = await tx
            .selectFrom("sessions")
            .select(["status", "bill_no"])
            .where("id", "=", currentPrimary)
            .where("outlet_id", "=", outletId)
            .executeTakeFirst();
          if (!primary || primary.status !== "active" || primary.bill_no) return false;
        }
        await tx
          .updateTable("sessions")
          .set({ merged_into: targetId })
          .where("id", "=", sessionId)
          .where("outlet_id", "=", outletId)
          .where("bill_no", "is", null)
          .execute();
        return true;
      }),

    unmergeIfActiveUnbilled: async (id: string, outletId: string) =>
      db.transaction().execute(async (tx) => {
        const initial = await tx
          .selectFrom("sessions")
          .select(["id", "status", "bill_no", "merged_into"])
          .where("id", "=", id)
          .where("outlet_id", "=", outletId)
          .executeTakeFirst();
        if (!initial) return false;
        const ids = [id, initial.merged_into].filter(Boolean).sort();
        for (const lockId of ids) {
          await tx
            .selectFrom("sessions")
            .select(["id", "status", "bill_no"])
            .where("id", "=", lockId)
            .where("outlet_id", "=", outletId)
            .forUpdate()
            .executeTakeFirst();
        }
        const row = await tx
          .selectFrom("sessions")
          .select(["id", "status", "bill_no", "merged_into"])
          .where("id", "=", id)
          .where("outlet_id", "=", outletId)
          .executeTakeFirst();
        if (!row || row.status !== "active" || row.bill_no) return false;
        if (row.merged_into) {
          const primary = await tx
            .selectFrom("sessions")
            .select(["status", "bill_no"])
            .where("id", "=", row.merged_into)
            .where("outlet_id", "=", outletId)
            .executeTakeFirst();
          if (!primary || primary.status !== "active" || primary.bill_no) return false;
        }
        await tx
          .updateTable("sessions")
          .set({ merged_into: null })
          .where("id", "=", id)
          .where("outlet_id", "=", outletId)
          .where("bill_no", "is", null)
          .execute();
        return true;
      }),

    releaseIfEmpty: async (id: string, outletId: string, closedAt: string) =>
      db.transaction().execute(async (tx) => {
        const session = await tx
          .selectFrom("sessions")
          .select(["id", "table_id", "status", "service_type", "bill_no", "merged_into"])
          .where("id", "=", id)
          .where("outlet_id", "=", outletId)
          .forUpdate()
          .executeTakeFirst();
        if (
          !session ||
          session.status !== "active" ||
          session.service_type !== "dine_in" ||
          !session.table_id ||
          session.merged_into ||
          session.bill_no
        )
          return null;
        const live = await tx
          .selectFrom("orders")
          .select("id")
          .where("session_id", "=", id)
          .where("outlet_id", "=", outletId)
          .where("status", "!=", "cancelled")
          .executeTakeFirst();
        if (live) return null;
        const mergedChild = await tx
          .selectFrom("sessions")
          .select("id")
          .where("merged_into", "=", id)
          .where("outlet_id", "=", outletId)
          .where("status", "=", "active")
          .executeTakeFirst();
        if (mergedChild) return null;
        await tx
          .updateTable("sessions")
          .set({ status: "closed", closed_at: closedAt })
          .where("id", "=", id)
          .where("outlet_id", "=", outletId)
          .where("status", "=", "active")
          .execute();
        return { tableId: session.table_id };
      }),

    // Invoice allocation and the bill compare-and-set share one transaction.
    // This avoids both duplicate invoice numbers and gaps/overwrites when two
    // counter requests arrive together.
    finalizeBill: async (
      id: string,
      patch: Updateable<SessionsTable>,
      outletId: string,
      datePart: string,
      freezeTipToAttendant: boolean,
    ) =>
      db
        .transaction()
        .execute((tx) => finalizeBillOn(tx, id, patch, outletId, datePart, freezeTipToAttendant)),

    // Used only when the caller already owns the surrounding transaction.
    finalizeBillInTransaction: (
      id: string,
      patch: Updateable<SessionsTable>,
      outletId: string,
      datePart: string,
      freezeTipToAttendant: boolean,
    ) => finalizeBillOn(db, id, patch, outletId, datePart, freezeTipToAttendant),

    // does this session belong to that table? guards the customer bill PATCH
    findOwnedByTable: async (id: string, tableId: string, outletId: string) => {
      let query = db
        .selectFrom("sessions")
        .select("id")
        .where("id", "=", id)
        .where("table_id", "=", tableId);
      query = query.where("outlet_id", "=", outletId);
      return (await query.executeTakeFirst()) ?? null;
    },

    // ---- conditional claims -------------------------------------------------

    // wins only if nobody else has set a discount meanwhile
    claimDiscount: async (id: string, pct: number, outletId: string) => {
      let query = db
        .updateTable("sessions")
        .set({ discount_pct: pct })
        .where("id", "=", id)
        .where("discount_pct", "=", 0);
      query = query
        .where("outlet_id", "=", outletId)
        .where("status", "=", "active")
        .where("bill_no", "is", null);
      return (await query.returning("discount_pct").executeTakeFirst()) ?? null;
    },

    // the comp flag is claimed BEFORE the free dish is created, so a lost race
    // never mints a second ticket
    claimComp: async (id: string, outletId: string) => {
      let query = db
        .updateTable("sessions")
        .set({ comp_awarded: true })
        .where("id", "=", id)
        .where("comp_awarded", "=", false);
      query = query
        .where("outlet_id", "=", outletId)
        .where("status", "=", "active")
        .where("bill_no", "is", null);
      return (await query.returning("id").executeTakeFirst()) ?? null;
    },

    // whoever attends the call takes the table, but never steals one that
    // somebody has already claimed
    claimWaiter: async (id: string, waiterId: string, outletId: string) => {
      let query = db
        .updateTable("sessions")
        .set({ attendant: waiterId })
        .where("id", "=", id)
        .where("attendant", "is", null);
      query = query.where("outlet_id", "=", outletId);
      return (await query.returning(["id", "attendant"]).executeTakeFirst()) ?? null;
    },

    // ---- reads for the staff screens ---------------------------------------

    // computeBill's embedded select: sessions -> table, orders -> items,
    // payments. Kept as ONE query with jsonObjectFrom/jsonArrayFrom, which is
    // the faithful translation of the PostgREST resource embedding and avoids
    // three round trips per table on a floor refresh.
    findForBilling: async (id: string, outletId: string, lock = false) => {
      let query = db
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
                      "order_items.status",
                      "order_items.name",
                      "order_items.qty",
                      "order_items.unit_price",
                      "order_items.gst_pct",
                    ])
                    .whereRef("order_items.order_id", "=", "orders.id"),
                ).as("items"),
              ])
              .where(
                "orders.session_id",
                "in",
                eb
                  .selectFrom("sessions")
                  .select("sessions.id")
                  .where("sessions.outlet_id", "=", outletId)
                  .where((eb3) =>
                    eb3.or([eb3("sessions.id", "=", id), eb3("sessions.merged_into", "=", id)]),
                  ),
              ),
          ).as("orders"),
          jsonArrayFrom(
            eb
              .selectFrom("payments")
              .select(["payments.amount_inr", "payments.status"])
              .where(
                "payments.session_id",
                "in",
                eb
                  .selectFrom("sessions")
                  .select("sessions.id")
                  .where("sessions.outlet_id", "=", outletId)
                  .where((eb3) =>
                    eb3.or([eb3("sessions.id", "=", id), eb3("sessions.merged_into", "=", id)]),
                  ),
              ),
          ).as("payments"),
        ])
        .where("sessions.id", "=", id);
      query = query.where("sessions.outlet_id", "=", outletId);
      if (lock) query = query.forUpdate();
      return (await query.executeTakeFirst()) ?? null;
    },

    // the waiter board: every active session with its rounds and payments
    listActiveForWaiter: async (outletId: string) => {
      let query = db
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
                    .select([
                      "order_items.id",
                      "order_items.name",
                      "order_items.qty",
                      "order_items.status",
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
        .where("sessions.status", "=", "active");
      query = query.where("sessions.outlet_id", "=", outletId);
      return query.execute();
    },

    // the floor board: lighter — no items, no payments
    listActiveForFloor: async (outletId: string) => {
      let query = db
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
        .where("sessions.status", "=", "active");
      query = query.where("sessions.outlet_id", "=", outletId);
      return query.execute();
    },

    // the counter board: rounds only, to count what is still unserved
    listActiveForCounter: async (outletId: string) => {
      let query = db
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
        .where("sessions.status", "=", "active");
      query = query.where("sessions.outlet_id", "=", outletId);
      return query.execute();
    },

    // ---- settlement ---------------------------------------------------------

    close: async (id: string, closedAt: string, outletId: string) => {
      let query = db
        .updateTable("sessions")
        .set({ status: "closed", closed_at: closedAt })
        .where("id", "=", id);
      query = query.where("outlet_id", "=", outletId);
      await query.execute();
    },

    listActiveMergedInto: async (primaryId: string, outletId: string) => {
      let query = db
        .selectFrom("sessions")
        .select(["id", "table_id"])
        .where("merged_into", "=", primaryId)
        .where("status", "=", "active");
      query = query.where("outlet_id", "=", outletId);
      return query.execute();
    },

    // paying the primary closes the whole merged group in one statement
    closeMergedInto: async (primaryId: string, closedAt: string, outletId: string) => {
      let query = db
        .updateTable("sessions")
        .set({ status: "closed", closed_at: closedAt })
        .where("merged_into", "=", primaryId)
        .where("status", "=", "active");
      query = query.where("outlet_id", "=", outletId);
      await query.execute();
    },

    // tips are tallied off the frozen bill rows, not the live totals
    listSettledSince: async (since: string, outletId: string) => {
      let query = db
        .selectFrom("sessions")
        .select(["tip_to", "bill_tip", "settled_at"])
        .where("settled_at", ">=", since);
      query = query.where("outlet_id", "=", outletId);
      return query.execute();
    },

    listSettledBetween: async (from: string, to: string, outletId: string) =>
      db
        .selectFrom("sessions")
        .select([
          "id",
          "bill_no",
          "bill_gross",
          "bill_discount",
          "bill_gst",
          "bill_service",
          "bill_tip",
          "bill_net",
          "guests",
          "tip_to",
          "settled_at",
        ])
        .where("outlet_id", "=", outletId)
        .where("settled_at", ">=", from)
        .where("settled_at", "<", to)
        .orderBy("settled_at")
        .execute(),
  };
}
