import { menuQuerySchema } from "@narada/shared";
import type { FastifyInstance } from "fastify";
import { fetchMenu } from "../services/menu.js";

// The SPA equivalent of the legacy server-rendered menu page.
export default async function menuRoutes(app: FastifyInstance): Promise<void> {
  app.get("/api/menu", async (request, reply) => {
    const parsed = menuQuerySchema.safeParse(request.query);
    if (!parsed.success) {
      return reply.status(400).send({ error: "table required" });
    }
    const menu = await fetchMenu(app.repos, parsed.data.table);
    if (!menu) {
      return reply.status(404).send({ error: "unknown table" });
    }
    return menu;
  });
}
