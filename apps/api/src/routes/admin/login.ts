import type { FastifyInstance } from "fastify";
import { adminLoginSchema } from "@narada/shared";
import { login } from "../../services/staffAuth.js";
import { clearRoleCookie, roleToken, setRoleCookie } from "../../plugins/auth.js";
import { rateLimited } from "../../lib/ratelimit.js";

// Port of web/app/api/admin/login/route.ts. Exempted from the auth plugin's
// cookie check in plugins/auth.ts so a signed-out staff member can reach it.
export default async function loginRoutes(app: FastifyInstance): Promise<void> {
  app.post("/api/admin/login", { ...rateLimited(10) }, async (request, reply) => {
    const parsed = adminLoginSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: parsed.error.issues[0]?.message ?? "pin required" });
    }
    const result = await login(app.repos, parsed.data.pin);
    if (!result) {
      return reply.status(401).send({ error: "wrong pin" });
    }
    setRoleCookie(reply, await roleToken(result.role));
    return reply.send({ ok: true, role: result.role, name: result.name });
  });

  app.delete("/api/admin/login", async (_request, reply) => {
    clearRoleCookie(reply);
    return reply.send({ ok: true });
  });
}
