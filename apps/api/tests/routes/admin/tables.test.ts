import { describe, expect, it } from "vitest";
import { buildApp } from "../../../src/app.js";
import { ADMIN_COOKIE, roleToken } from "../../../src/plugins/auth.js";
import { seed } from "../../helpers/fakeRepos.js";

async function adminCookie() {
  return { [ADMIN_COOKIE]: await roleToken("admin") };
}

describe("GET /api/admin/tables", () => {
  it("lists tables with the outlet name", async () => {
    const { repos } = seed();
    const app = buildApp({ repos });
    const res = await app.inject({ url: "/api/admin/tables", cookies: await adminCookie() });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.tables.length).toBe(2);
    expect(body.outletName).toBe("Spice Garden");
  });
});

describe("POST /api/admin/tables", () => {
  it("creates a batch of tables", async () => {
    const { repos } = seed();
    const app = buildApp({ repos });
    const res = await app.inject({
      method: "POST",
      url: "/api/admin/tables",
      cookies: await adminCookie(),
      payload: { count: 3 },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ ok: true, added: 3 });
  });

  it("400s without label or count", async () => {
    const { repos } = seed();
    const app = buildApp({ repos });
    const res = await app.inject({
      method: "POST",
      url: "/api/admin/tables",
      cookies: await adminCookie(),
      payload: {},
    });
    expect(res.statusCode).toBe(400);
  });
});

describe("PATCH /api/admin/tables", () => {
  it("updates a table", async () => {
    const { repos, ids } = seed();
    const app = buildApp({ repos });
    const res = await app.inject({
      method: "PATCH",
      url: "/api/admin/tables",
      cookies: await adminCookie(),
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
      cookies: await adminCookie(),
    });
    expect(res.statusCode).toBe(409);
  });

  it("removes a table with no active session", async () => {
    const { repos, ids } = seed();
    const app = buildApp({ repos });
    const res = await app.inject({
      method: "DELETE",
      url: `/api/admin/tables?id=${ids.tableB}`,
      cookies: await adminCookie(),
    });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ ok: true });
  });
});
