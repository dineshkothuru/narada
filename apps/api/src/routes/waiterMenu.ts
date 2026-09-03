import { waiterMenuQuerySchema } from "@narada/shared";
import type { FastifyInstance } from "fastify";
import { waiterMenu } from "../services/waiterMenu.js";

export default async function waiterMenuRoutes(app: FastifyInstance): Promise<void> {
  app.get("/api/waiter/menu", async (request, reply) => {
    const parsed = waiterMenuQuerySchema.safeParse(request.query);
    if (!parsed.success) return reply.status(400).send({ error: "table required" });
    return waiterMenu(app.repos, parsed.data.table, request.staffSession!.outletId);
  });
}
