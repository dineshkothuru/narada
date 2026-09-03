import { waiterPatchSchema } from "@narada/shared";
import type { FastifyInstance } from "fastify";
import { cancelOrderItem } from "../services/order.js";
import {
  ackCall,
  clearTable,
  markItemServed,
  markServed,
  waiterBoard,
  waiterRecordPayment,
} from "../services/waiter.js";

// Port of web/app/api/waiter/route.ts. Role gating (admin + waiter) is
// already applied by the auth plugin for the /api/waiter prefix.
export default async function waiterRoutes(app: FastifyInstance): Promise<void> {
  app.get("/api/waiter", async (request) => waiterBoard(app.repos, request.staffSession!.outletId));

  app.patch("/api/waiter", async (request, reply) => {
    const parsed = waiterPatchSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: "invalid action" });
    }
    const body = parsed.data;

    if (body.action === "ack_call" && body.callId) {
      return ackCall(
        app.repos,
        {
          callId: body.callId,
          sessionId: body.sessionId,
        },
        request.staffSession!.outletId,
        request.staffSession!.displayName,
      );
    }

    if (body.action === "mark_item_served" && body.itemId) {
      return markItemServed(app.repos, body.itemId, request.staffSession!.outletId);
    }

    if (body.action === "cancel_item" && body.itemId) {
      return cancelOrderItem(app.repos, body.itemId, {
        kind: "staff",
        outletId: request.staffSession!.outletId,
        staffId: request.staffSession!.staffId,
        role: request.staffSession!.role,
        actorName: request.staffSession!.displayName,
        reason: body.reason,
      });
    }

    if (body.action === "mark_served" && body.orderId) {
      return markServed(app.repos, body.orderId, request.staffSession!.outletId);
    }

    if (body.action === "clear_table" && body.tableId) {
      return clearTable(app.repos, body.tableId, request.staffSession!.outletId);
    }

    if (body.action === "record_payment" && body.sessionId) {
      return waiterRecordPayment(
        app.repos,
        {
          sessionId: body.sessionId,
          amount: body.amount,
          method: body.method,
          utr: body.utr,
        },
        request.staffSession!.outletId,
        request.staffSession!.displayName,
        {
          staffId: request.staffSession!.staffId,
          role: request.staffSession!.role,
          actorName: request.staffSession!.displayName,
        },
      );
    }

    return reply.status(400).send({ error: "invalid action" });
  });
}
