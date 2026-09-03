import { billQuerySchema, patchBillSchema } from "@narada/shared";
import type { FastifyInstance } from "fastify";
import { HttpError } from "../lib/http.js";
import { rateLimited } from "../lib/ratelimit.js";
import { customerBill, patchCustomerBill } from "../services/customerBill.js";

// Port of web/app/api/bill/route.ts GET + PATCH.
export default async function billRoutes(app: FastifyInstance): Promise<void> {
  // Customer-facing bill preview: itemised, GST, service charge, tip.
  app.get("/api/bill", async (request, reply) => {
    const parsed = billQuerySchema.safeParse(request.query);
    if (!parsed.success) {
      return reply.status(400).send({ error: "session required" });
    }
    try {
      const tipRaw = Number(parsed.data.tip ?? 0);
      const tip = Number.isFinite(tipRaw) ? tipRaw : 0;
      return await customerBill(app.repos, parsed.data.session, tip);
    } catch (error) {
      if (error instanceof HttpError) throw error;
      request.log.error(error);
      return reply.status(500).send({ error: "failed" });
    }
  });

  // Customer asks for the service charge to be removed (their legal right in India)
  app.patch("/api/bill", { ...rateLimited(20) }, async (request, reply) => {
    const parsed = patchBillSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: "sessionId required" });
    }
    try {
      return await patchCustomerBill(app.repos, parsed.data);
    } catch (error) {
      if (error instanceof HttpError) throw error;
      request.log.error(error);
      return reply.status(500).send({ error: "failed" });
    }
  });
}
