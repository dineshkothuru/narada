import { describe, expect, it, vi } from "vitest";
import { buildApp } from "../../src/app.js";
import { seed } from "../helpers/fakeRepos.js";

describe("POST /api/waiter-call", () => {
  it("opens a call for the table", async () => {
    const { data, repos } = seed();
    const app = buildApp({ repos });
    const res = await app.inject({
      method: "POST",
      url: "/api/waiter-call",
      payload: { tableCode: "t1-demo" },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ ok: true });
    expect(data.waiter_calls).toHaveLength(1);
  });

  it("does not open a second call while one is already open", async () => {
    const { data, repos } = seed();
    const app = buildApp({ repos });
    await app.inject({
      method: "POST",
      url: "/api/waiter-call",
      payload: { tableCode: "t1-demo" },
    });
    await app.inject({
      method: "POST",
      url: "/api/waiter-call",
      payload: { tableCode: "t1-demo" },
    });
    expect(data.waiter_calls).toHaveLength(1);
  });

  it("400s when tableCode is missing", async () => {
    const { repos } = seed();
    const app = buildApp({ repos });
    const res = await app.inject({ method: "POST", url: "/api/waiter-call", payload: {} });
    expect(res.statusCode).toBe(400);
    expect(res.json()).toEqual({ error: "tableCode required" });
  });

  it("404s for an unknown table", async () => {
    const { repos } = seed();
    const app = buildApp({ repos });
    const res = await app.inject({
      method: "POST",
      url: "/api/waiter-call",
      payload: { tableCode: "nope" },
    });
    expect(res.statusCode).toBe(404);
  });

  it("maps an unexpected repository failure to the legacy error", async () => {
    const { repos } = seed();
    vi.spyOn(repos.tables, "findByCode").mockRejectedValue(new Error("db down"));
    const app = buildApp({ repos });
    const res = await app.inject({
      method: "POST",
      url: "/api/waiter-call",
      payload: { tableCode: "t1-demo" },
    });
    expect(res.statusCode).toBe(500);
    expect(res.json()).toEqual({ error: "failed" });
  });

  it("returns the legacy error after more than 6 calls", async () => {
    const { repos } = seed();
    const app = buildApp({ repos });
    for (let attempt = 0; attempt < 6; attempt += 1) {
      await app.inject({
        method: "POST",
        url: "/api/waiter-call",
        payload: { tableCode: "t1-demo" },
      });
    }
    const res = await app.inject({
      method: "POST",
      url: "/api/waiter-call",
      payload: { tableCode: "t1-demo" },
    });
    expect(res.statusCode).toBe(429);
    expect(res.json()).toEqual({ error: "too many requests" });
  });
});
