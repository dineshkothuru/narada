import { waiterCallSchema } from "@narada/shared";
import type { FastifyInstance } from "fastify";
import { HttpError } from "../lib/http.js";
import { rateLimited } from "../lib/ratelimit.js";
import { callWaiter } from "../services/waiterCall.js";

// Port of web/app/api/waiter-call/route.ts POST.
export default async function waiterCallRoutes(app: FastifyInstance): Promise<void> {
  app.post("/api/waiter-call", { ...rateLimited(6) }, async (request, reply) => {
    const parsed = waiterCallSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: "tableCode required" });
    }
    try {
      return await callWaiter(app.repos, parsed.data.tableCode);
    } catch (error) {
      if (error instanceof HttpError) throw error;
      request.log.error(error);
      return reply.status(500).send({ error: "failed" });
    }
  });
}
