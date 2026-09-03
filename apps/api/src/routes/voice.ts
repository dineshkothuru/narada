import { voiceSchema } from "@narada/shared";
import type { FastifyInstance } from "fastify";
import { rateLimited } from "../lib/ratelimit.js";
import { processVoiceTurn } from "../services/speech.js";
import { customerCapabilityContext } from "../services/customerSession.js";
import { CUSTOMER_COOKIE } from "../lib/customerCapability.js";

// Port of web/app/api/voice/route.ts POST.
export default async function voiceRoutes(app: FastifyInstance): Promise<void> {
  app.post("/api/voice", { ...rateLimited(20), bodyLimit: 4_100_000 }, async (request, reply) => {
    const parsed = voiceSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: "audio, text or greet required" });
    }

    try {
      const customer = await customerCapabilityContext(app.repos, request.cookies[CUSTOMER_COOKIE]);
      if (customer && parsed.data.outletSlug && parsed.data.outletSlug !== customer.outlet.slug) {
        return reply.status(403).send({ error: "outlet does not match customer session" });
      }
      const outlet = customer
        ? customer.outlet
        : parsed.data.outletSlug
          ? await app.repos.outlets.findActiveBySlug(parsed.data.outletSlug)
          : null;
      if (parsed.data.outletSlug && !outlet) {
        return reply.status(404).send({ error: "unknown outlet" });
      }
      return await processVoiceTurn(app.repos, parsed.data, outlet?.id);
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
