import type { Insertable, Kysely } from "kysely";
import type { DB, PaymentsTable } from "../db/types.js";

export function makePaymentsRepo(db: Kysely<DB>) {
  return {
    create: async (row: Insertable<PaymentsTable>) => {
      await db.insertInto("payments").values(row).execute();
    },

    // A payment closes over the session row. Locking that row and calculating
    // the remaining balance inside one transaction prevents two simultaneous
    // collectors from both accepting the same final payment.
    recordConfirmed: async (
      input: {
        sessionId: string;
        amount?: number;
        method: string;
        utr?: string;
        collector?: string;
      },
      outletId: string,
    ) =>
      db.transaction().execute(async (tx) => {
        const session = await tx
          .selectFrom("sessions")
          .select([
            "id",
            "status",
            "bill_no",
            "bill_net",
            "bill_tip",
            "tip_to",
            "attendant",
            "table_id",
          ])
          .where("id", "=", input.sessionId)
          .where("outlet_id", "=", outletId)
          .forUpdate()
          .executeTakeFirst();
        if (
          !session ||
          session.status !== "active" ||
          !session.bill_no ||
          session.bill_net === null
        ) {
          return null;
        }

        const paidRow = await tx
          .selectFrom("payments")
          .select((eb) => eb.fn.coalesce(eb.fn.sum<number>("amount_inr"), eb.val(0)).as("paid"))
          .where("session_id", "=", input.sessionId)
          .where("status", "=", "confirmed")
          .executeTakeFirst();
        const paid = Number(paidRow?.paid ?? 0);
        const due = Math.max(0, Math.round(Number(session.bill_net) - paid));
        const amount = input.amount === undefined ? due : Math.max(0, Math.round(input.amount));
        const tip = Math.max(0, amount - due);
        const collector = (input.collector?.trim() || "").slice(0, 40);
        const reference = [
          session.bill_no,
          tip > 0 ? `incl. tip ₹${tip}` : null,
          input.utr ? `UTR ${input.utr.trim().slice(0, 40)}` : null,
          collector ? `collected by ${collector}` : "confirmed by staff",
        ]
          .filter(Boolean)
          .join(" · ");

        if (tip > 0) {
          await tx
            .updateTable("sessions")
            .set({
              bill_tip: Math.round(Number(session.bill_tip ?? 0) + tip),
              bill_net: Math.round(Number(session.bill_net) + tip),
              tip_to: session.tip_to ?? session.attendant ?? null,
            })
            .where("id", "=", input.sessionId)
            .where("outlet_id", "=", outletId)
            .execute();
        }

        await tx
          .insertInto("payments")
          .values({
            session_id: input.sessionId,
            amount_inr: amount,
            method: input.method,
            status: "confirmed",
            reference,
          })
          .execute();

        const remaining = Math.max(0, due - amount);
        const closed = remaining <= 0;
        if (closed) {
          await tx
            .updateTable("sessions")
            .set({ status: "closed", closed_at: new Date().toISOString() })
            .where("id", "=", input.sessionId)
            .where("outlet_id", "=", outletId)
            .where("status", "=", "active")
            .execute();
        }
        return {
          amount,
          tip,
          due: remaining,
          closed,
          billNo: session.bill_no,
          tableId: session.table_id,
        };
      }),

    listBySession: async (sessionId: string) =>
      db
        .selectFrom("payments")
        .select(["amount_inr", "status", "method"])
        .where("session_id", "=", sessionId)
        .execute(),

    listConfirmedForSessions: async (sessionIds: string[], outletId: string) => {
      if (sessionIds.length === 0) return [];
      return db
        .selectFrom("payments")
        .innerJoin("sessions", "sessions.id", "payments.session_id")
        .select([
          "payments.session_id",
          "payments.amount_inr",
          "payments.method",
          "payments.status",
        ])
        .where("payments.session_id", "in", sessionIds)
        .where("payments.status", "=", "confirmed")
        .where("sessions.outlet_id", "=", outletId)
        .execute();
    },
  };
}
