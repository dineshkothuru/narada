import type { FastifyInstance } from "fastify";

export default async function meRoutes(app: FastifyInstance): Promise<void> {
  app.get("/api/admin/me", async (request, reply) => {
    if (!request.staffSession) return reply.status(401).send({ error: "unauthorized" });
    const { staff, outlet, role } = request.staffSession;
    return {
      role,
      staff: { ...staff, role },
      outlet,
      staffId: staff.id,
      outletId: outlet.id,
      username: staff.username,
      firstName: staff.firstName,
      lastName: staff.lastName,
      displayName: staff.displayName,
    };
  });
}
