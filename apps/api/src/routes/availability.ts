import { availabilityPatchSchema } from "@narada/shared";
import type { FastifyInstance } from "fastify";
import { availabilityBoard, setAvailability } from "../services/availability.js";

export default async function availabilityRoutes(app: FastifyInstance): Promise<void> {
  app.get("/api/availability", async (request) =>
    availabilityBoard(app.repos, request.staffSession!.outletId),
  );

  app.patch("/api/availability", async (request, reply) => {
    const parsed = availabilityPatchSchema.safeParse(request.body);
    if (!parsed.success)
      return reply.status(400).send({ error: "menuItemId and available required" });
    return setAvailability(app.repos, parsed.data, request.staffSession!.outletId, {
      staffId: request.staffSession!.staffId,
      role: request.staffSession!.role,
      displayName: request.staffSession!.displayName,
    });
  });
}
