import { describe, expect, it } from "vitest";
import { buildApp } from "../../../src/app.js";
import { seed } from "../../helpers/fakeRepos.js";
import { staffCookie } from "../../helpers/staffCookie.js";

describe("POST /api/admin/categories", () => {
  it("creates a category", async () => {
    const { data, repos } = seed();
    const app = buildApp({ repos });
    const res = await app.inject({
      method: "POST",
      url: "/api/admin/categories",
      cookies: staffCookie(data, "admin"),
      payload: { name: "Desserts", emoji: "🍰" },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().ok).toBe(true);
  });

  it("400s on a missing name", async () => {
    const { data, repos } = seed();
    const app = buildApp({ repos });
    const res = await app.inject({
      method: "POST",
      url: "/api/admin/categories",
      cookies: staffCookie(data, "admin"),
      payload: {},
    });
    expect(res.statusCode).toBe(400);
  });

  it("401s without a cookie", async () => {
    const { repos } = seed();
    const app = buildApp({ repos });
    const res = await app.inject({
      method: "POST",
      url: "/api/admin/categories",
      payload: { name: "Desserts" },
    });
    expect(res.statusCode).toBe(401);
  });
});

describe("DELETE /api/admin/categories", () => {
  it("deletes a category with no order history", async () => {
    const { data, repos, ids } = seed();
    const app = buildApp({ repos });
    const res = await app.inject({
      method: "DELETE",
      url: `/api/admin/categories?id=${ids.category}`,
      cookies: staffCookie(data, "admin"),
    });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ ok: true });
  });

  it("400s without an id", async () => {
    const { data, repos } = seed();
    const app = buildApp({ repos });
    const res = await app.inject({
      method: "DELETE",
      url: "/api/admin/categories",
      cookies: staffCookie(data, "admin"),
    });
    expect(res.statusCode).toBe(400);
  });
});
