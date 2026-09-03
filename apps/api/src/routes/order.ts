import { orderQuerySchema, placeOrderSchema } from "@narada/shared";
import type { FastifyInstance } from "fastify";
import { HttpError } from "../lib/http.js";
import { rateLimited } from "../lib/ratelimit.js";
import { getOrderStatus, getSessionOrders, placeOrder } from "../services/order.js";

// Port of web/app/api/order/route.ts POST + GET.
export default async function orderRoutes(app: FastifyInstance): Promise<void> {
  app.post("/api/order", { ...rateLimited(15) }, async (request, reply) => {
    const parsed = placeOrderSchema.safeParse(request.body);
    if (!parsed.success) {
      // every shape failure here (missing tableCode, missing/empty/malformed
      // cart) maps to this one legacy message
      return reply.status(400).send({ error: "tableCode and cart required" });
    }
    try {
      return await placeOrder(app.repos, parsed.data);
    } catch (error) {
      if (error instanceof HttpError) throw error;
      request.log.error(error);
      return reply.status(500).send({ error: "could not place order" });
    }
  });

  app.get("/api/order", async (request, reply) => {
    const parsed = orderQuerySchema.safeParse(request.query);
    if (!parsed.success) {
      return reply.status(400).send({ error: "id or session required" });
    }
    try {
      const { id, session } = parsed.data;
      if (session) {
        return await getSessionOrders(app.repos, session);
      }
      if (!id) {
        return reply.status(400).send({ error: "id or session required" });
      }
      return await getOrderStatus(app.repos, id);
    } catch (error) {
      if (error instanceof HttpError) throw error;
      request.log.error(error);
      return reply.status(500).send({ error: "lookup failed" });
    }
  });
}
