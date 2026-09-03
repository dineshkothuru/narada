import { describe, expect, it } from "vitest";
import { buildApp } from "../../src/app.js";
import { ADMIN_COOKIE, roleToken } from "../../src/plugins/auth.js";
import { seed } from "../helpers/fakeRepos.js";

const cookieFor = async (role: "kitchen" | "waiter" | "admin" | "cashier" | "reception") =>
  `${ADMIN_COOKIE}=${await roleToken(role)}`;

describe("GET /api/floor", () => {
  it("200s for reception and shows table stats", async () => {
    const { repos } = seed();
    const app = buildApp({ repos });
    const res = await app.inject({
      url: "/api/floor",
      headers: { cookie: await cookieFor("reception") },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().stats.total).toBe(2);
  });

  it("403s a role floor excludes", async () => {
    const { repos } = seed();
    const app = buildApp({ repos });
    const res = await app.inject({
      url: "/api/floor",
      headers: { cookie: await cookieFor("kitchen") },
    });
    expect(res.statusCode).toBe(403);
  });
});

describe("PATCH /api/floor", () => {
  it("seats a table", async () => {
    const { data, repos, ids } = seed();
    const app = buildApp({ repos });
    const res = await app.inject({
      method: "PATCH",
      url: "/api/floor",
      headers: { cookie: await cookieFor("reception") },
      payload: { action: "seat", tableId: ids.tableA, guests: 3 },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toMatchObject({ ok: true });
    expect(data.sessions).toHaveLength(1);
    expect(data.sessions[0].guests).toBe(3);
  });

  it("404s seating an unknown table", async () => {
    const { repos } = seed();
    const app = buildApp({ repos });
    const res = await app.inject({
      method: "PATCH",
      url: "/api/floor",
      headers: { cookie: await cookieFor("reception") },
      payload: { action: "seat", tableId: "00000000-0000-0000-0000-000000000000" },
    });
    expect(res.statusCode).toBe(404);
    expect(res.json()).toEqual({ error: "unknown table" });
  });

  it("400s an unknown action", async () => {
    const { repos } = seed();
    const app = buildApp({ repos });
    const res = await app.inject({
      method: "PATCH",
      url: "/api/floor",
      headers: { cookie: await cookieFor("reception") },
      payload: { action: "bogus" },
    });
    expect(res.statusCode).toBe(400);
    expect(res.json()).toEqual({ error: "invalid action" });
  });

  it("403s a role floor excludes", async () => {
    const { repos } = seed();
    const app = buildApp({ repos });
    const res = await app.inject({
      method: "PATCH",
      url: "/api/floor",
      headers: { cookie: await cookieFor("kitchen") },
      payload: { action: "clear_table", tableId: "x" },
    });
    expect(res.statusCode).toBe(403);
  });
});
