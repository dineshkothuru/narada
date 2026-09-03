import { billQuerySchema, patchBillSchema } from "@narada/shared";
import type { FastifyInstance } from "fastify";
import { HttpError } from "../lib/http.js";
import { rateLimited } from "../lib/ratelimit.js";
import { CUSTOMER_COOKIE } from "../lib/customerCapability.js";
import { requireCustomerSession } from "../services/customerSession.js";
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
      const customer = request.staffSession
        ? null
        : await requireCustomerSession(
            app.repos,
            request.cookies[CUSTOMER_COOKIE],
            parsed.data.session,
          );
      const outletId = request.staffSession?.outletId ?? customer?.outlet.id;
      return await customerBill(
        app.repos,
        customer?.session.id ?? parsed.data.session,
        tip,
        outletId,
        request.staffSession ? parsed.data.tableCode : undefined,
      );
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
      const customer = request.staffSession
        ? null
        : await requireCustomerSession(
            app.repos,
            request.cookies[CUSTOMER_COOKIE],
            parsed.data.sessionId,
          );
      return await patchCustomerBill(
        app.repos,
        customer
          ? { ...parsed.data, sessionId: customer.session.id, tableCode: undefined }
          : parsed.data,
        request.staffSession?.outletId ?? customer?.outlet.id,
        request.staffSession
          ? {
              staffId: request.staffSession.staffId,
              role: request.staffSession.role,
              actorName: request.staffSession.displayName,
            }
          : undefined,
      );
    } catch (error) {
      if (error instanceof HttpError) throw error;
      request.log.error(error);
      return reply.status(500).send({ error: "failed" });
    }
  });
}
