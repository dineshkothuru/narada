import { waiterPatchSchema } from "@narada/shared";
import type { FastifyInstance } from "fastify";
import {
  ackCall,
  clearTable,
  markServed,
  waiterBoard,
  waiterRecordPayment,
} from "../services/waiter.js";

// Port of web/app/api/waiter/route.ts. Role gating (admin + waiter) is
// already applied by the auth plugin for the /api/waiter prefix.
export default async function waiterRoutes(app: FastifyInstance): Promise<void> {
  app.get("/api/waiter", async () => waiterBoard(app.repos));

  app.patch("/api/waiter", async (request, reply) => {
    const parsed = waiterPatchSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: "invalid action" });
    }
    const body = parsed.data;

    if (body.action === "ack_call" && body.callId) {
      return ackCall(app.repos, {
        callId: body.callId,
        attendedBy: body.attendedBy,
        sessionId: body.sessionId,
      });
    }

    if (body.action === "mark_served" && body.orderId) {
      return markServed(app.repos, body.orderId);
    }

    if (body.action === "clear_table" && body.tableId) {
      return clearTable(app.repos, body.tableId);
    }

    if (body.action === "record_payment" && body.sessionId) {
      return waiterRecordPayment(app.repos, {
        sessionId: body.sessionId,
        amount: body.amount,
        method: body.method,
        utr: body.utr,
        collectedBy: body.collectedBy,
      });
    }

    return reply.status(400).send({ error: "invalid action" });
  });
}
