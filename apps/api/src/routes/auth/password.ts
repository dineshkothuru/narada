import type { FastifyInstance } from "fastify";
import { passwordSchema } from "@narada/shared";
import { changePassword } from "../../services/staffAuth.js";

export default async function staffPasswordRoutes(app: FastifyInstance): Promise<void> {
  app.patch("/api/auth/staff/password", async (request, reply) => {
    if (!request.staffSession) return reply.status(401).send({ error: "unauthorized" });
    const body = request.body as { currentPassword?: unknown; newPassword?: unknown };
    if (
      typeof body?.currentPassword !== "string" ||
      typeof body?.newPassword !== "string" ||
      !passwordSchema.safeParse(body.newPassword).success
    ) {
      return reply.status(400).send({ error: "invalid password" });
    }
    return changePassword(app.repos, request.staffSession, body.currentPassword, body.newPassword);
  });
}
