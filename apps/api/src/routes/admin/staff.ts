import type { FastifyInstance } from "fastify";
import { createStaffSchema, deleteStaffQuerySchema, patchStaffSchema } from "@narada/shared";
import { createStaff, deleteStaff, listStaff, patchStaff } from "../../services/adminStaff.js";

export default async function staffRoutes(app: FastifyInstance): Promise<void> {
  app.get("/api/admin/staff", async (request) => listStaff(app.repos, request.staffSession!));
  app.post("/api/admin/staff", async (request, reply) => {
    const parsed = createStaffSchema.safeParse(request.body);
    if (!parsed.success)
      return reply.status(400).send({ error: parsed.error.issues[0]?.message ?? "invalid staff" });
    return createStaff(app.repos, parsed.data, request.staffSession!);
  });
  app.patch("/api/admin/staff", async (request, reply) => {
    const parsed = patchStaffSchema.safeParse(request.body);
    if (!parsed.success)
      return reply.status(400).send({ error: parsed.error.issues[0]?.message ?? "invalid staff" });
    return patchStaff(app.repos, parsed.data, request.staffSession!);
  });
  app.delete("/api/admin/staff", async (request, reply) => {
    const parsed = deleteStaffQuerySchema.safeParse(request.query);
    if (!parsed.success)
      return reply
        .status(400)
        .send({ error: parsed.error.issues[0]?.message ?? "staffId required" });
    return deleteStaff(
      app.repos,
      parsed.data.staffId ?? parsed.data.id ?? "",
      request.staffSession!,
    );
  });
}
