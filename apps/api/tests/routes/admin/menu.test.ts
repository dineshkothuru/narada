import { describe, expect, it } from "vitest";
import { buildApp } from "../../../src/app.js";
import { seed } from "../../helpers/fakeRepos.js";
import { staffCookie } from "../../helpers/staffCookie.js";

describe("GET /api/admin/menu", () => {
  it("returns categories, items and the outlet", async () => {
    const { data, repos } = seed();
    const app = buildApp({ repos });
    const res = await app.inject({ url: "/api/admin/menu", cookies: staffCookie(data, "admin") });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.categories.length).toBeGreaterThan(0);
    expect(body.items.length).toBeGreaterThan(0);
    expect(body.outlet).toBeTruthy();
  });
});

describe("POST /api/admin/menu", () => {
  it("creates a dish", async () => {
    const { data, repos, ids } = seed();
    const app = buildApp({ repos });
    const res = await app.inject({
      method: "POST",
      url: "/api/admin/menu",
      cookies: staffCookie(data, "admin"),
      payload: { category_id: ids.category, name: "Chilli Paneer", price_inr: 260 },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().ok).toBe(true);
  });

  it("400s on invalid price", async () => {
    const { data, repos, ids } = seed();
    const app = buildApp({ repos });
    const res = await app.inject({
      method: "POST",
      url: "/api/admin/menu",
      cookies: staffCookie(data, "admin"),
      payload: { category_id: ids.category, name: "X", price_inr: -1 },
    });
    expect(res.statusCode).toBe(400);
  });
});

describe("PATCH /api/admin/menu", () => {
  it("updates a dish", async () => {
    const { data, repos, ids } = seed();
    const app = buildApp({ repos });
    const res = await app.inject({
      method: "PATCH",
      url: "/api/admin/menu",
      cookies: staffCookie(data, "admin"),
      payload: { itemId: ids.items[0], is_available: false },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ ok: true });
  });
});

describe("DELETE /api/admin/menu", () => {
  it("deletes a dish", async () => {
    const { data, repos, ids } = seed();
    const app = buildApp({ repos });
    const res = await app.inject({
      method: "DELETE",
      url: `/api/admin/menu?itemId=${ids.items[0]}`,
      cookies: staffCookie(data, "admin"),
    });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ ok: true });
  });

  it("400s without itemId", async () => {
    const { data, repos } = seed();
    const app = buildApp({ repos });
    const res = await app.inject({
      method: "DELETE",
      url: "/api/admin/menu",
      cookies: staffCookie(data, "admin"),
    });
    expect(res.statusCode).toBe(400);
  });
});
