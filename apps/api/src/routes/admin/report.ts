import { adminReportQuerySchema } from "@narada/shared";
import type { FastifyInstance } from "fastify";
import { dayReport } from "../../services/adminReport.js";

export default async function reportRoutes(app: FastifyInstance): Promise<void> {
  app.get("/api/admin/report", async (request, reply) => {
    const parsed = adminReportQuerySchema.safeParse(request.query);
    if (!parsed.success) return reply.status(400).send({ error: "bad date" });
    return dayReport(app.repos, request.staffSession!.outletId, parsed.data.day);
  });
}
