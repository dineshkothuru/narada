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
});
