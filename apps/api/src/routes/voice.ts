import { voiceSchema } from "@narada/shared";
import type { FastifyInstance } from "fastify";
import { rateLimited } from "../lib/ratelimit.js";
import { processVoiceTurn } from "../services/speech.js";

// Port of web/app/api/voice/route.ts POST.
export default async function voiceRoutes(app: FastifyInstance): Promise<void> {
  app.post("/api/voice", { ...rateLimited(20) }, async (request, reply) => {
    const parsed = voiceSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: "audio, text or greet required" });
    }

    try {
      return await processVoiceTurn(app.repos, parsed.data);
    } catch (e) {
      // service throws HttpError for the well-known cases (missing key,
      // audio too long, STT failures) — the app error handler renders those
      // with their intended status. Anything else is an unexpected failure.
      if (e && typeof e === "object" && "statusCode" in e) throw e;
      request.log.error(e);
      return reply.status(500).send({ error: "voice failed" });
    }
  });
}
