import { sessionQuerySchema } from "@narada/shared";
import type { FastifyInstance } from "fastify";
import { HttpError } from "../lib/http.js";
import { sessionForTable } from "../services/session.js";

// Port of web/app/api/session/route.ts GET. Customer-facing: does this table
// already have an active session? Lets a freshly-scanned phone join the
// group's live order view.
export default async function sessionRoutes(app: FastifyInstance): Promise<void> {
  app.get("/api/session", async (request, reply) => {
    const parsed = sessionQuerySchema.safeParse(request.query);
    if (!parsed.success) {
      return reply.status(400).send({ error: "table required" });
    }
    try {
      return await sessionForTable(app.repos, parsed.data.table);
    } catch (error) {
      if (error instanceof HttpError) throw error;
      request.log.error(error);
      return reply.status(500).send({ error: "failed" });
    }
  });
}
