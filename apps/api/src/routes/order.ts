import { cancelOrderItemQuerySchema, orderQuerySchema, placeOrderSchema } from "@narada/shared";
import type { FastifyInstance } from "fastify";
import { HttpError } from "../lib/http.js";
import { rateLimited } from "../lib/ratelimit.js";
import { CUSTOMER_COOKIE } from "../lib/customerCapability.js";
import { requireCustomerSession } from "../services/customerSession.js";
import {
  cancelOrderItem,
  getOrderStatus,
  getSessionOrders,
  placeOrder,
} from "../services/order.js";

// Port of web/app/api/order/route.ts POST + GET.
export default async function orderRoutes(app: FastifyInstance): Promise<void> {
  app.post("/api/order", { ...rateLimited(15) }, async (request, reply) => {
    if (
      request.staffSession &&
      request.staffSession.role !== "admin" &&
      request.staffSession.role !== "waiter"
    ) {
      return reply.status(403).send({ error: "forbidden for your role" });
    }
    const parsed = placeOrderSchema.safeParse(request.body);
    if (!parsed.success) {
      // every shape failure here (missing tableCode, missing/empty/malformed
      // cart) maps to this one legacy message
      return reply.status(400).send({ error: "tableCode and cart required" });
    }
    try {
      if (request.staffSession) {
        if (!parsed.data.tableCode) {
          return reply.status(400).send({ error: "tableCode and cart required" });
        }
        return await placeOrder(app.repos, {
          cart: parsed.data.cart,
          tableCode: parsed.data.tableCode,
          outletId: request.staffSession.outletId,
          placedVia: "waiter",
          guestName: request.staffSession.displayName,
          lang: parsed.data.lang,
        });
      }
      const customer = await requireCustomerSession(
        app.repos,
        request.cookies[CUSTOMER_COOKIE],
        parsed.data.sessionId,
      );
      return await placeOrder(app.repos, {
        ...parsed.data,
        sessionId: customer.session.id,
        outletId: customer.outlet.id,
        tableCode: undefined,
        placedVia: parsed.data.placedVia === "anna" ? "anna" : "ui",
      });
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
      const { id, session, tableCode } = parsed.data;
      if (!request.staffSession) {
        const customer = await requireCustomerSession(
          app.repos,
          request.cookies[CUSTOMER_COOKIE],
          session,
        );
        const scopedSession = customer.session.id;
        if (session)
          return await getSessionOrders(app.repos, scopedSession, undefined, customer.outlet.id);
        if (!id) return reply.status(400).send({ error: "id or session required" });
        return await getOrderStatus(app.repos, id, undefined, customer.outlet.id, scopedSession);
      }
      if (session) {
        const outletId = request.staffSession?.outletId;
        return await getSessionOrders(app.repos, session, tableCode, outletId);
      }
      if (!id) {
        return reply.status(400).send({ error: "id or session required" });
      }
      const outletId = request.staffSession?.outletId;
      if (!request.staffSession && !tableCode) {
        return reply.status(400).send({ error: "tableCode required" });
      }
      return await getOrderStatus(app.repos, id, tableCode, outletId);
    } catch (error) {
      if (error instanceof HttpError) throw error;
      request.log.error(error);
      return reply.status(500).send({ error: "lookup failed" });
    }
  });

  app.delete("/api/order", { ...rateLimited(15) }, async (request, reply) => {
    const parsed = cancelOrderItemQuerySchema.safeParse(request.query);
    if (!parsed.success) return reply.status(400).send({ error: "itemId required" });

    if (request.staffSession) {
      if (!["admin", "waiter", "cashier"].includes(request.staffSession.role)) {
        return reply.status(403).send({ error: "forbidden for your role" });
      }
      return cancelOrderItem(app.repos, parsed.data.itemId, {
        kind: "staff",
        outletId: request.staffSession.outletId,
        staffId: request.staffSession.staffId,
        role: request.staffSession.role,
        actorName: request.staffSession.displayName,
      });
    }

    try {
      const customer = await requireCustomerSession(app.repos, request.cookies[CUSTOMER_COOKIE]);
      return await cancelOrderItem(app.repos, parsed.data.itemId, {
        kind: "customer",
        outletId: customer.outlet.id,
        sessionId: customer.session.id,
      });
    } catch (error) {
      if (error instanceof HttpError) throw error;
      request.log.error(error);
      return reply.status(500).send({ error: "could not cancel item" });
    }
  });
}
