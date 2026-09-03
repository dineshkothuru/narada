import type { FastifyInstance } from "fastify";
import { tipsForDay } from "../services/tips.js";

// Port of web/app/api/waiter/tips/route.ts. Today's tips, per waiter. Gated
// to admin + waiter by the /api/waiter prefix in ROLE_ACCESS.
export default async function waiterTipsRoutes(app: FastifyInstance): Promise<void> {
  app.get("/api/waiter/tips", async () => tipsForDay(app.repos, new Date()));
}
