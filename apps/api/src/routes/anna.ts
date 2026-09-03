import { annaSchema } from "@narada/shared";
import type { FastifyInstance } from "fastify";
import { rateLimited } from "../lib/ratelimit.js";
import { askAnnaForTable } from "../services/agent.js";

// Port of web/app/api/anna/route.ts POST.
export default async function annaRoutes(app: FastifyInstance): Promise<void> {
  app.post("/api/anna", { ...rateLimited(30) }, async (request, reply) => {
    const parsed = annaSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: "messages required" });
    }
    try {
      return await askAnnaForTable(app.repos, parsed.data);
    } catch (e) {
      request.log.error(e);
      return reply.status(502).send({ error: "Anna is unavailable right now" });
    }
  });
}
