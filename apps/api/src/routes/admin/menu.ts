import type { FastifyInstance } from "fastify";
import {
  createMenuItemSchema,
  deleteMenuItemQuerySchema,
  patchMenuItemSchema,
} from "@narada/shared";
import {
  createMenuItem,
  deleteMenuItem,
  getAdminMenu,
  patchMenuItem,
} from "../../services/adminMenu.js";

// Port of web/app/api/admin/menu/route.ts.
export default async function menuRoutes(app: FastifyInstance): Promise<void> {
  app.get("/api/admin/menu", async (request, reply) => {
    const result = await getAdminMenu(app.repos, request.staffSession!.outletId);
    return reply.send(result);
  });

  app.post("/api/admin/menu", async (request, reply) => {
    const parsed = createMenuItemSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({
        error:
          parsed.error.issues[0]?.message ?? "category_id, name and positive price_inr required",
      });
    }
    const result = await createMenuItem(app.repos, parsed.data, request.staffSession!.outletId);
    return reply.send(result);
  });

  app.delete("/api/admin/menu", async (request, reply) => {
    const parsed = deleteMenuItemQuerySchema.safeParse(request.query);
    if (!parsed.success) {
      return reply
        .status(400)
        .send({ error: parsed.error.issues[0]?.message ?? "itemId required" });
    }
    const result = await deleteMenuItem(
      app.repos,
      parsed.data.itemId,
      request.staffSession!.outletId,
    );
    return reply.send(result);
  });

  app.patch("/api/admin/menu", async (request, reply) => {
    const parsed = patchMenuItemSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply
        .status(400)
        .send({ error: parsed.error.issues[0]?.message ?? "itemId required" });
    }
    const result = await patchMenuItem(app.repos, parsed.data, request.staffSession!.outletId);
    return reply.send(result);
  });
}
