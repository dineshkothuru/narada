import type { FastifyInstance } from "fastify";
import { createStaffSchema, deleteStaffQuerySchema, patchStaffSchema } from "@narada/shared";
import { createStaff, deleteStaff, listStaff, patchStaff } from "../../services/adminStaff.js";

// Port of web/app/api/admin/staff/route.ts.
export default async function staffRoutes(app: FastifyInstance): Promise<void> {
  app.get("/api/admin/staff", async (_request, reply) => {
    const result = await listStaff(app.repos);
    return reply.send(result);
  });

  app.post("/api/admin/staff", async (request, reply) => {
    const parsed = createStaffSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({
        error: parsed.error.issues[0]?.message ?? "name, role and a PIN of 4+ characters required",
      });
    }
    const result = await createStaff(app.repos, parsed.data);
    return reply.send(result);
  });

  app.patch("/api/admin/staff", async (request, reply) => {
    const parsed = patchStaffSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply
        .status(400)
        .send({ error: parsed.error.issues[0]?.message ?? "staffId and active required" });
    }
    const result = await patchStaff(app.repos, parsed.data);
    return reply.send(result);
  });

  app.delete("/api/admin/staff", async (request, reply) => {
    const parsed = deleteStaffQuerySchema.safeParse(request.query);
    if (!parsed.success) {
      return reply.status(400).send({ error: parsed.error.issues[0]?.message ?? "id required" });
    }
    const result = await deleteStaff(app.repos, parsed.data.id);
    return reply.send(result);
  });
}
