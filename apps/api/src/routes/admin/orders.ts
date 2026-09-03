import type { FastifyInstance } from "fastify";
import { adminOrdersQuerySchema } from "@narada/shared";
import { listAdminOrders } from "../../services/admin.js";

// Port of web/app/api/admin/orders/route.ts.
export default async function ordersRoutes(app: FastifyInstance): Promise<void> {
  app.get("/api/admin/orders", async (request, reply) => {
    const parsed = adminOrdersQuerySchema.safeParse(request.query);
    if (!parsed.success) {
      return reply.status(400).send({ error: parsed.error.issues[0]?.message ?? "invalid range" });
    }
    const result = await listAdminOrders(
      app.repos,
      parsed.data.range,
      request.staffSession!.outletId,
    );
    return reply.send(result);
  });
}
