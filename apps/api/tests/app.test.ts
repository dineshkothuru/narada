import { describe, expect, it } from "vitest";
import { buildApp } from "../src/app.js";

describe("buildApp", () => {
  it("GET /health returns ok", async () => {
    const app = buildApp();
    const res = await app.inject({ url: "/health" });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ ok: true });
  });

  it("GET /api/health returns ok", async () => {
    const app = buildApp();
    const res = await app.inject({ url: "/api/health" });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ ok: true });
  });

  it("registers every API route plugin", async () => {
    const app = buildApp();
    await app.ready();
    for (const [method, url] of [
      ["POST", "/api/admin/categories"],
      ["POST", "/api/admin/image"],
      ["GET", "/api/admin/me"],
      ["GET", "/api/admin/menu"],
      ["GET", "/api/admin/orders"],
      ["PATCH", "/api/admin/settings"],
      ["GET", "/api/admin/staff"],
      ["GET", "/api/admin/tables"],
      ["GET", "/api/bill"],
      ["GET", "/api/counter"],
      ["GET", "/api/floor"],
      ["GET", "/api/kitchen"],
      ["GET", "/api/menu"],
      ["GET", "/api/order"],
      ["POST", "/api/reward"],
      ["GET", "/api/session"],
      ["POST", "/api/outlet/:slug/session"],
      ["POST", "/api/outlet/:slug/table/:tableCode/session"],
      ["POST", "/api/outlet/:slug/login"],
      ["DELETE", "/api/auth/staff/logout"],
      ["GET", "/api/outlets/table/:tableCode"],
      ["POST", "/api/voice"],
      ["GET", "/api/waiter"],
      ["POST", "/api/waiter-call"],
      ["GET", "/api/waiter/tips"],
    ] as const) {
      expect(app.hasRoute({ method, url })).toBe(true);
    }
    for (const [method, url] of [
      ["POST", "/api/auth/staff/login"],
      ["DELETE", "/api/auth/staff/login"],
      ["POST", "/api/admin/login"],
      ["DELETE", "/api/admin/login"],
      ["GET", "/api/auth/outlets"],
    ] as const) {
      expect(app.hasRoute({ method, url })).toBe(false);
    }
  });
});
