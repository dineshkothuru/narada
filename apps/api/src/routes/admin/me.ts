import type { FastifyInstance } from "fastify";

// Who is logged in — drives which nav items and screens the UI offers.
// The auth plugin has already rejected an absent or expired cookie with 401.
// Moved out of app.ts (foundation put it there inline); behaviour unchanged.
export default async function meRoutes(app: FastifyInstance): Promise<void> {
  app.get("/api/admin/me", async (request) => ({ role: request.staffRole }));
}
