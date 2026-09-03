import { kitchenPatchSchema } from "@narada/shared";
import type { FastifyInstance } from "fastify";
import { kitchenOrders, updateItemStatus, updateOrderStatus } from "../services/kitchen.js";

// Port of web/app/api/kitchen/route.ts. Role gating (admin + kitchen) is
// already applied by the auth plugin for the /api/kitchen prefix.
export default async function kitchenRoutes(app: FastifyInstance): Promise<void> {
  app.get("/api/kitchen", async () => {
    const orders = await kitchenOrders(app.repos);
    return { orders };
  });

  app.patch("/api/kitchen", async (request, reply) => {
    const parsed = kitchenPatchSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: "orderId and valid status required" });
    }
    const { orderId, status, itemId, itemStatus } = parsed.data;

    // per-dish update takes priority, exactly like the legacy handler. zod
    // already rejected anything outside the enum, so the 400 below is the
    // "itemId without itemStatus" case only.
    if (itemId && itemStatus) {
      return updateItemStatus(app.repos, itemId, itemStatus);
    }
    if (itemId || itemStatus) {
      return reply.status(400).send({ error: "invalid item status" });
    }

    if (!orderId || !status) {
      return reply.status(400).send({ error: "orderId and valid status required" });
    }
    return updateOrderStatus(app.repos, orderId, status);
  });
}
