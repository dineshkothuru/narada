import { describe, expect, it } from "vitest";
import { buildApp } from "../../src/app.js";
import { seed } from "../helpers/fakeRepos.js";
import { staffHeader } from "../helpers/staffCookie.js";

describe("GET /api/floor", () => {
  it("200s for reception and shows table stats", async () => {
    const { data, repos } = seed();
    const app = buildApp({ repos });
    const res = await app.inject({
      url: "/api/floor",
      headers: { cookie: staffHeader(data, "reception") },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().stats.total).toBe(2);
  });

  it("403s a role floor excludes", async () => {
    const { data, repos } = seed();
    const app = buildApp({ repos });
    const res = await app.inject({
      url: "/api/floor",
      headers: { cookie: staffHeader(data, "kitchen") },
    });
    expect(res.statusCode).toBe(403);
  });
});

describe("PATCH /api/floor", () => {
  it("releases an empty seated table through the authenticated host", async () => {
    const { data, repos, ids } = seed();
    const session = await repos.sessions.create({ table_id: ids.tableA, outlet_id: ids.outlet });
    const app = buildApp({ repos });
    const res = await app.inject({
      method: "PATCH",
      url: "/api/floor",
      headers: { cookie: staffHeader(data, "reception") },
      payload: { action: "release", sessionId: session.id },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ ok: true });
    expect(data.sessions[0].status).toBe("closed");
    expect(data.audit_log[0]).toMatchObject({ action: "table_released", role: "reception" });
  });

  it("seats a table", async () => {
    const { data, repos, ids } = seed();
    const app = buildApp({ repos });
    const res = await app.inject({
      method: "PATCH",
      url: "/api/floor",
      headers: { cookie: staffHeader(data, "reception") },
      payload: { action: "seat", tableId: ids.tableA, guests: 3 },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toMatchObject({ ok: true });
    expect(data.sessions).toHaveLength(1);
    expect(data.sessions[0].guests).toBe(3);
  });

  it("attributes a session to the authenticated staff member", async () => {
    const { data, repos, ids } = seed();
    const sessionId = "aaaaaaaa-6666-0000-0000-000000000002";
    data.sessions.push({
      id: sessionId,
      table_id: ids.tableA,
      outlet_id: ids.outlet,
      status: "active",
      created_at: new Date().toISOString(),
      attendant: null,
    });
    const app = buildApp({ repos });
    const res = await app.inject({
      method: "PATCH",
      url: "/api/floor",
      headers: { cookie: staffHeader(data, "reception") },
      payload: {
        action: "attendant",
        sessionId,
        attendant: "attacker-controlled name",
      },
    });
    expect(res.statusCode).toBe(200);
    expect(data.sessions.find((s) => s.id === sessionId)?.attendant).toBe("Demo Reception");
  });

  it("404s seating an unknown table", async () => {
    const { data, repos } = seed();
    const app = buildApp({ repos });
    const res = await app.inject({
      method: "PATCH",
      url: "/api/floor",
      headers: { cookie: staffHeader(data, "reception") },
      payload: { action: "seat", tableId: "00000000-0000-0000-0000-000000000000" },
    });
    expect(res.statusCode).toBe(404);
    expect(res.json()).toEqual({ error: "unknown table" });
  });

  it("400s an unknown action", async () => {
    const { data, repos } = seed();
    const app = buildApp({ repos });
    const res = await app.inject({
      method: "PATCH",
      url: "/api/floor",
      headers: { cookie: staffHeader(data, "reception") },
      payload: { action: "bogus" },
    });
    expect(res.statusCode).toBe(400);
    expect(res.json()).toEqual({ error: "invalid action" });
  });

  it("403s a role floor excludes", async () => {
    const { data, repos } = seed();
    const app = buildApp({ repos });
    const res = await app.inject({
      method: "PATCH",
      url: "/api/floor",
      headers: { cookie: staffHeader(data, "kitchen") },
      payload: { action: "clear_table", tableId: "x" },
    });
    expect(res.statusCode).toBe(403);
  });
});
