import type { FastifyInstance } from "fastify";
import { patchSettingsSchema } from "@narada/shared";
import { updateSettings } from "../../services/admin.js";

// Port of web/app/api/admin/settings/route.ts.
export default async function settingsRoutes(app: FastifyInstance): Promise<void> {
  app.patch("/api/admin/settings", async (request, reply) => {
    const parsed = patchSettingsSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply
        .status(400)
        .send({ error: parsed.error.issues[0]?.message ?? "outletId required" });
    }
    const result = await updateSettings(app.repos, parsed.data);
    return reply.send(result);
  });
}
