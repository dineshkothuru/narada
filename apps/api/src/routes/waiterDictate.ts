import { waiterDictateSchema } from "@narada/shared";
import type { FastifyInstance } from "fastify";
import { dictateOrder } from "../services/dictate.js";

export default async function waiterDictateRoutes(app: FastifyInstance): Promise<void> {
  app.post("/api/waiter/dictate", async (request, reply) => {
    const parsed = waiterDictateSchema.safeParse(request.body);
    if (!parsed.success) return reply.status(400).send({ error: "tableCode required" });
    return dictateOrder(app.repos, parsed.data, request.staffSession!.outletId);
  });
}
