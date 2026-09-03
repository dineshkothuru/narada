import { describe, expect, it, vi } from "vitest";
import { buildApp } from "../../src/app.js";
import { seed } from "../helpers/fakeRepos.js";

describe("GET /api/session", () => {
  it("returns null when the table has no active session", async () => {
    const { repos } = seed();
    const app = buildApp({ repos });
    const res = await app.inject({ method: "GET", url: "/api/session?table=t1-demo" });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ sessionId: null });
  });

  it("returns the active session id once one exists", async () => {
    const { data, repos, ids } = seed();
    data.sessions.push({
      id: "s1",
      table_id: ids.tableA,
      outlet_id: ids.outlet,
      status: "active",
      created_at: new Date().toISOString(),
      closed_at: null,
      discount_pct: 0,
      comp_awarded: false,
      guests: null,
      attendant: null,
      merged_into: null,
      service_waived: false,
      bill_no: null,
      bill_tip: null,
      tip_to: null,
      settled_at: null,
    });
    const app = buildApp({ repos });
    const res = await app.inject({ method: "GET", url: "/api/session?table=t1-demo" });
    expect(res.json()).toEqual({ sessionId: "s1" });
  });

  it("400s when table is missing", async () => {
    const { repos } = seed();
    const app = buildApp({ repos });
    const res = await app.inject({ method: "GET", url: "/api/session" });
    expect(res.statusCode).toBe(400);
    expect(res.json()).toEqual({ error: "table required" });
  });

  it("404s for an unknown table code", async () => {
    const { repos } = seed();
    const app = buildApp({ repos });
    const res = await app.inject({ method: "GET", url: "/api/session?table=nope" });
    expect(res.statusCode).toBe(404);
    expect(res.json()).toEqual({ error: "unknown table" });
  });

  it("maps an unexpected repository failure to the legacy error", async () => {
    const { repos } = seed();
    vi.spyOn(repos.tables, "findByCode").mockRejectedValue(new Error("db down"));
    const app = buildApp({ repos });
    const res = await app.inject({ method: "GET", url: "/api/session?table=t1-demo" });
    expect(res.statusCode).toBe(500);
    expect(res.json()).toEqual({ error: "failed" });
  });
});
