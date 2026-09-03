import { counterPatchSchema } from "@narada/shared";
import type { FastifyInstance } from "fastify";
import {
  counterBoard,
  counterGenerateBill,
  counterRecordPayment,
  waiveService,
} from "../services/counter.js";

// Port of web/app/api/counter/route.ts (main's renamed outlet/outlet_id
// version). Role gating (admin + cashier) is already applied by the auth
// plugin for the /api/counter prefix.
export default async function counterRoutes(app: FastifyInstance): Promise<void> {
  app.get("/api/counter", async () => counterBoard(app.repos));

  app.patch("/api/counter", async (request, reply) => {
    const parsed = counterPatchSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: "invalid action" });
    }
    const body = parsed.data;

    if (body.action === "waive_service" && body.sessionId) {
      return waiveService(app.repos, body.sessionId, body.waived);
    }

    // raising the bill is the counter's alone
    if (body.action === "generate_bill" && body.sessionId) {
      return counterGenerateBill(app.repos, body.sessionId);
    }

    if (body.action === "record_payment" && body.sessionId) {
      return counterRecordPayment(app.repos, {
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
