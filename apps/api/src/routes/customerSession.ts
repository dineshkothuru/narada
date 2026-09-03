import { customerSessionSchema } from "@narada/shared";
import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import {
  CUSTOMER_COOKIE,
  setCustomerCookie,
  verifyCustomerCapability,
} from "../lib/customerCapability.js";
import { HttpError } from "../lib/http.js";
import { rateLimited } from "../lib/ratelimit.js";
import { createCustomerSession } from "../services/customerSession.js";

export default async function customerSessionRoutes(app: FastifyInstance): Promise<void> {
  app.get("/api/outlets/table/:tableCode", async (request, reply) => {
    const code = String((request.params as { tableCode: string }).tableCode);
    const table = await app.repos.tables.findByCode(code);
    const outlet = table ? await app.repos.outlets.findActiveById(table.outlet_id) : null;
    if (!table || !outlet || !outlet.tables_enabled) {
      return reply.status(404).send({ error: "unknown table" });
    }
    return { outletSlug: outlet.slug, tableCode: code };
  });

  app.post("/api/outlet/:slug/session", { ...rateLimited(20) }, async (request, reply) => {
    return start(app, request, reply, null);
  });

  app.post(
    "/api/outlet/:slug/table/:tableCode/session",
    { ...rateLimited(20) },
    async (request, reply) => {
      return start(
        app,
        request,
        reply,
        String((request.params as { tableCode: string }).tableCode),
      );
    },
  );

  app.get("/api/outlet/:slug/session", async (request, reply) => {
    const token = request.cookies[CUSTOMER_COOKIE];
    const slug = String((request.params as { slug: string }).slug);
    const claims = verifyCustomerCapability(token);
    if (!claims) return reply.status(401).send({ error: "customer session required" });
    const outlet = await app.repos.outlets.findActiveBySlug(slug);
    if (!outlet || outlet.id !== claims.outletId) {
      return reply.status(404).send({ error: "unknown outlet" });
    }
    const session = await app.repos.sessions.findById(claims.sessionId, claims.outletId);
    if (!session || session.status !== "active" || session.service_type !== "takeaway") {
      return reply.status(401).send({ error: "customer session required" });
    }
    return {
      sessionId: session.id,
      serviceType: session.service_type,
      tableLabel: session.table_id
        ? ((await app.repos.tables.findById(session.table_id, outlet.id))?.label ?? "Dine-in")
        : "Takeaway",
      outlet: {
        id: outlet.id,
        name: outlet.name,
        slug: outlet.slug,
        tablesEnabled: Boolean(outlet.tables_enabled),
      },
    };
  });
}

async function start(
  app: FastifyInstance,
  request: FastifyRequest,
  reply: FastifyReply,
  forcedTableCode: string | null,
) {
  const parsed = customerSessionSchema.safeParse(request.body ?? {});
  const tableCode =
    forcedTableCode === null
      ? undefined
      : (forcedTableCode ?? (parsed.success ? parsed.data.tableCode : undefined));
  if (!parsed.success) return reply.status(400).send({ error: "invalid session request" });
  try {
    const result = await createCustomerSession(
      app.repos,
      String((request.params as { slug: string }).slug),
      tableCode,
      request.cookies[CUSTOMER_COOKIE],
      request.customerSession?.customer.id,
    );
    setCustomerCookie(reply, result.capability);
    return result.response;
  } catch (error) {
    if (error instanceof HttpError) throw error;
    request.log.error(error);
    return reply.status(500).send({ error: "failed" });
  }
}
