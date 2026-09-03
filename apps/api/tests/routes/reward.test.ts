import { describe, expect, it, vi } from "vitest";
import { buildApp } from "../../src/app.js";
import { seed } from "../helpers/fakeRepos.js";

describe("POST /api/reward", () => {
  it("spins the wheel for a known table", async () => {
    const { repos } = seed();
    const app = buildApp({ repos });
    const res = await app.inject({
      method: "POST",
      url: "/api/reward",
      payload: { tableCode: "t1-demo", type: "spin" },
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(typeof body.ok).toBe("boolean");
    expect(typeof body.sliceIndex).toBe("number");
  });

  it("400s a comp claim before any order exists", async () => {
    const { repos } = seed();
    const app = buildApp({ repos });
    const res = await app.inject({
      method: "POST",
      url: "/api/reward",
      payload: { tableCode: "t1-demo", type: "comp" },
    });
    expect(res.statusCode).toBe(400);
    expect(res.json()).toEqual({ ok: false, reason: "no orders yet" });
  });

  it("400s with the legacy message when both fields are missing", async () => {
    const { repos } = seed();
    const app = buildApp({ repos });
    const res = await app.inject({ method: "POST", url: "/api/reward", payload: {} });
    expect(res.statusCode).toBe(400);
    expect(res.json()).toEqual({ error: "tableCode and type required" });
  });

  it("400s with the legacy message when type is an invalid value", async () => {
    const { repos } = seed();
    const app = buildApp({ repos });
    const res = await app.inject({
      method: "POST",
      url: "/api/reward",
      payload: { tableCode: "t1-demo", type: "bogus" },
    });
    expect(res.statusCode).toBe(400);
    expect(res.json()).toEqual({ error: "tableCode and type required" });
  });

  it("404s for an unknown table", async () => {
    const { repos } = seed();
    const app = buildApp({ repos });
    const res = await app.inject({
      method: "POST",
      url: "/api/reward",
      payload: { tableCode: "nope", type: "spin" },
    });
    expect(res.statusCode).toBe(404);
  });

  it("maps an unexpected repository failure to the legacy error", async () => {
    const { repos } = seed();
    vi.spyOn(repos.tables, "findByCode").mockRejectedValue(new Error("db down"));
    const app = buildApp({ repos });
    const res = await app.inject({
      method: "POST",
      url: "/api/reward",
      payload: { tableCode: "t1-demo", type: "spin" },
    });
    expect(res.statusCode).toBe(500);
    expect(res.json()).toEqual({ error: "failed" });
  });

  it("preserves the known missing-comp error body", async () => {
    const { data, repos, ids } = seed();
    const app = buildApp({ repos });
    await app.inject({
      method: "POST",
      url: "/api/order",
      payload: { tableCode: "t1-demo", cart: [{ itemId: ids.items[0], qty: 1 }] },
    });
    data.menu_items.splice(2, 1);
    const res = await app.inject({
      method: "POST",
      url: "/api/reward",
      payload: { tableCode: "t1-demo", type: "comp" },
    });
    expect(res.statusCode).toBe(500);
    expect(res.json()).toEqual({ error: "comp item missing" });
  });
});
