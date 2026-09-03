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
      ["POST", "/api/admin/login"],
      ["GET", "/api/admin/me"],
      ["GET", "/api/admin/menu"],
      ["GET", "/api/admin/orders"],
      ["PATCH", "/api/admin/settings"],
      ["GET", "/api/admin/staff"],
      ["GET", "/api/admin/tables"],
      ["POST", "/api/anna"],
      ["GET", "/api/bill"],
      ["GET", "/api/counter"],
      ["GET", "/api/floor"],
      ["GET", "/api/kitchen"],
      ["GET", "/api/menu"],
      ["GET", "/api/order"],
      ["POST", "/api/reward"],
      ["GET", "/api/session"],
      ["POST", "/api/voice"],
      ["GET", "/api/waiter"],
      ["POST", "/api/waiter-call"],
      ["GET", "/api/waiter/tips"],
    ] as const) {
      expect(app.hasRoute({ method, url })).toBe(true);
    }
  });
});
