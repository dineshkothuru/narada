import { menuQuerySchema } from "@narada/shared";
import type { FastifyInstance } from "fastify";
import { fetchMenu, fetchOutletMenu } from "../services/menu.js";

// The SPA equivalent of the legacy server-rendered menu page.
export default async function menuRoutes(app: FastifyInstance): Promise<void> {
  app.get("/api/outlet/:slug/menu", async (request, reply) => {
    const { tableCode } = request.query as { tableCode?: string };
    const menu = await fetchOutletMenu(
      app.repos,
      String((request.params as { slug: string }).slug),
      tableCode,
    );
    if (!menu) return reply.status(404).send({ error: "unknown outlet" });
    return menu;
  });

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
