import type { FastifyInstance } from "fastify";
import { kitchenKot } from "../services/kot.js";

export default async function kotRoutes(app: FastifyInstance): Promise<void> {
  app.get("/api/kitchen/kot/:order", async (request) => {
    const { order } = request.params as { order: string };
    return kitchenKot(app.repos, order, request.staffSession!.outletId);
  });
}
