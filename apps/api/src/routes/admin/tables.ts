import type { FastifyInstance } from "fastify";
import { createTablesSchema, deleteTableQuerySchema, patchTableSchema } from "@narada/shared";
import {
  createTables,
  deleteTable,
  getAdminTables,
  patchTable,
} from "../../services/adminTables.js";

// Port of web/app/api/admin/tables/route.ts.
export default async function tablesRoutes(app: FastifyInstance): Promise<void> {
  app.get("/api/admin/tables", async (request, reply) => {
    const result = await getAdminTables(app.repos, request.staffSession!.outletId);
    return reply.send(result);
  });

  app.post("/api/admin/tables", async (request, reply) => {
    const parsed = createTablesSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply
        .status(400)
        .send({ error: parsed.error.issues[0]?.message ?? "label or count required" });
    }
    const result = await createTables(app.repos, parsed.data, request.staffSession!.outletId);
    return reply.send(result);
  });

  app.patch("/api/admin/tables", async (request, reply) => {
    const parsed = patchTableSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply
        .status(400)
        .send({ error: parsed.error.issues[0]?.message ?? "tableId required" });
    }
    const result = await patchTable(app.repos, parsed.data, request.staffSession!.outletId);
    return reply.send(result);
  });

  app.delete("/api/admin/tables", async (request, reply) => {
    const parsed = deleteTableQuerySchema.safeParse(request.query);
    if (!parsed.success) {
      return reply.status(400).send({ error: parsed.error.issues[0]?.message ?? "id required" });
    }
    const result = await deleteTable(app.repos, parsed.data.id, request.staffSession!.outletId);
    return reply.send(result);
  });
}
