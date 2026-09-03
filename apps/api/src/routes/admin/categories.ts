import type { FastifyInstance } from "fastify";
import { createCategorySchema, deleteCategoryQuerySchema } from "@narada/shared";
import { createCategory, deleteCategory } from "../../services/admin.js";

// Port of web/app/api/admin/categories/route.ts.
export default async function categoriesRoutes(app: FastifyInstance): Promise<void> {
  app.post("/api/admin/categories", async (request, reply) => {
    const parsed = createCategorySchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: parsed.error.issues[0]?.message ?? "name required" });
    }
    const result = await createCategory(app.repos, parsed.data);
    return reply.send(result);
  });

  app.delete("/api/admin/categories", async (request, reply) => {
    const parsed = deleteCategoryQuerySchema.safeParse(request.query);
    if (!parsed.success) {
      return reply.status(400).send({ error: parsed.error.issues[0]?.message ?? "id required" });
    }
    const result = await deleteCategory(app.repos, parsed.data.id);
    return reply.send(result);
  });
}
