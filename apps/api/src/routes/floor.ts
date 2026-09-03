import { floorPatchSchema } from "@narada/shared";
import type { FastifyInstance } from "fastify";
import {
  clearTable,
  floorBoard,
  mergeSession,
  seatTable,
  setAttendant,
  unmergeSession,
} from "../services/floor.js";

// Port of web/app/api/floor/route.ts. Role gating (admin, waiter, reception,
// cashier) is already applied by the auth plugin for the /api/floor prefix.
export default async function floorRoutes(app: FastifyInstance): Promise<void> {
  app.get("/api/floor", async () => floorBoard(app.repos));

  app.patch("/api/floor", async (request, reply) => {
    const parsed = floorPatchSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: "invalid action" });
    }
    const body = parsed.data;

    if (body.action === "clear_table" && body.tableId) {
      return clearTable(app.repos, body.tableId);
    }

    if (body.action === "attendant" && body.sessionId) {
      return setAttendant(app.repos, body.sessionId, body.attendant);
    }

    if (body.action === "seat" && body.tableId) {
      return seatTable(app.repos, body.tableId, body.guests);
    }

    if (body.action === "merge" && body.sessionId && body.intoSessionId) {
      return mergeSession(app.repos, body.sessionId, body.intoSessionId);
    }

    if (body.action === "unmerge" && body.sessionId) {
      return unmergeSession(app.repos, body.sessionId);
    }

    return reply.status(400).send({ error: "invalid action" });
  });
}
