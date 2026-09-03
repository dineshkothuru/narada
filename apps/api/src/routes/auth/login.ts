import type { FastifyInstance } from "fastify";
import { outletStaffLoginSchema } from "@narada/shared";
import { login } from "../../services/staffAuth.js";
import { clearStaffCookie, setStaffCookie } from "../../plugins/auth.js";
import { rateLimited } from "../../lib/ratelimit.js";

export default async function staffLoginRoutes(app: FastifyInstance): Promise<void> {
  app.post("/api/outlet/:slug/login", { ...rateLimited(10) }, async (request, reply) => {
    const parsed = outletStaffLoginSchema.safeParse(request.body);
    const slug = String((request.params as { slug: string }).slug);
    if (!parsed.success) return reply.status(401).send({ error: "invalid credentials" });
    const outlet = await app.repos.outlets.findActiveBySlug(slug);
    const result = outlet
      ? await login(app.repos, outlet.id, parsed.data.username, parsed.data.password)
      : null;
    if (!result) return reply.status(401).send({ error: "invalid credentials" });
    setStaffCookie(reply, result.token);
    return reply.send({ ok: true, role: result.role, staff: result.staff, outlet: result.outlet });
  });

  app.delete("/api/auth/staff/logout", async (_request, reply) => {
    clearStaffCookie(reply);
    return reply.send({ ok: true });
  });
}
