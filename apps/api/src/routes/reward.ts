import { rewardSchema } from "@narada/shared";
import type { FastifyInstance } from "fastify";
import { HttpError } from "../lib/http.js";
import { rateLimited } from "../lib/ratelimit.js";
import { claimComp, spin } from "../services/reward.js";

// Port of web/app/api/reward/route.ts POST.
export default async function rewardRoutes(app: FastifyInstance): Promise<void> {
  app.post("/api/reward", { ...rateLimited(10) }, async (request, reply) => {
    const parsed = rewardSchema.safeParse(request.body);
    if (!parsed.success) {
      // every schema failure here (missing tableCode, missing type, or an
      // invalid type value) maps to this single legacy message
      return reply.status(400).send({ error: "tableCode and type required" });
    }
    try {
      const { tableCode, type } = parsed.data;
      if (type === "spin") {
        return await spin(app.repos, tableCode);
      }
      const result = await claimComp(app.repos, tableCode);
      if (!result.ok && result.reason === "no orders yet") {
        return reply.status(400).send(result);
      }
      return result;
    } catch (error) {
      if (error instanceof HttpError) {
        // app.ts intentionally redacts generic 500s; this is a known domain
        // failure whose legacy body is part of the customer contract.
        if (error.statusCode === 500) {
          return reply.status(500).send({ error: error.message });
        }
        throw error;
      }
      request.log.error(error);
      return reply.status(500).send({ error: "failed" });
    }
  });
}
