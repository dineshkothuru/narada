import { describe, expect, it } from "vitest";
import { buildApp } from "../../../src/app.js";
import { seed } from "../../helpers/fakeRepos.js";
import { staffCookie } from "../../helpers/staffCookie.js";

const adminCookie = (data: Parameters<typeof staffCookie>[0]) => staffCookie(data, "admin");

describe("GET /api/admin/tables", () => {
  it("lists tables with the outlet name", async () => {
    const { data, repos } = seed();
    const app = buildApp({ repos });
    const res = await app.inject({ url: "/api/admin/tables", cookies: adminCookie(data) });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.tables.length).toBe(2);
    expect(body.outletName).toBe("Spice Garden");
  });
});

describe("POST /api/admin/tables", () => {
  it("creates a batch of tables", async () => {
    const { data, repos } = seed();
    const app = buildApp({ repos });
    const res = await app.inject({
      method: "POST",
      url: "/api/admin/tables",
      cookies: adminCookie(data),
      payload: { count: 3 },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ ok: true, added: 3 });
  });

  it("400s without label or count", async () => {
    const { data, repos } = seed();
    const app = buildApp({ repos });
    const res = await app.inject({
      method: "POST",
      url: "/api/admin/tables",
      cookies: adminCookie(data),
      payload: {},
    });
    expect(res.statusCode).toBe(400);
  });
});

describe("PATCH /api/admin/tables", () => {
  it("updates a table", async () => {
    const { data, repos, ids } = seed();
    const app = buildApp({ repos });
    const res = await app.inject({
      method: "PATCH",
      url: "/api/admin/tables",
      cookies: adminCookie(data),
      payload: { tableId: ids.tableA, capacity: 8 },
    });
    expect(res.statusCode).toBe(200);
  });
});

describe("DELETE /api/admin/tables", () => {
  it("409s when the table has an open tab", async () => {
    const { data, repos, ids } = seed();
    data.sessions.push({
      id: "s1",
      table_id: ids.tableA,
      outlet_id: ids.outlet,
      status: "active",
      created_at: new Date().toISOString(),
      discount_pct: 0,
      comp_awarded: false,
    });
    const app = buildApp({ repos });
    const res = await app.inject({
      method: "DELETE",
      url: `/api/admin/tables?id=${ids.tableA}`,
      cookies: adminCookie(data),
    });
    expect(res.statusCode).toBe(409);
  });

  it("removes a table with no active session", async () => {
    const { data, repos, ids } = seed();
    const app = buildApp({ repos });
    const res = await app.inject({
      method: "DELETE",
      url: `/api/admin/tables?id=${ids.tableB}`,
      cookies: adminCookie(data),
    });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ ok: true });
  });
});
