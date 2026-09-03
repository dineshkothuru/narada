import { describe, expect, it } from "vitest";
import { buildApp } from "../../../src/app.js";
import { ADMIN_COOKIE, roleToken } from "../../../src/plugins/auth.js";
import { seed } from "../../helpers/fakeRepos.js";

async function adminCookie() {
  return { [ADMIN_COOKIE]: await roleToken("admin") };
}

describe("POST /api/admin/categories", () => {
  it("creates a category", async () => {
    const { repos } = seed();
    const app = buildApp({ repos });
    const res = await app.inject({
      method: "POST",
      url: "/api/admin/categories",
      cookies: await adminCookie(),
      payload: { name: "Desserts", emoji: "🍰" },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().ok).toBe(true);
  });

  it("400s on a missing name", async () => {
    const { repos } = seed();
    const app = buildApp({ repos });
    const res = await app.inject({
      method: "POST",
      url: "/api/admin/categories",
      cookies: await adminCookie(),
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
    const { repos, ids } = seed();
    const app = buildApp({ repos });
    const res = await app.inject({
      method: "DELETE",
      url: `/api/admin/categories?id=${ids.category}`,
      cookies: await adminCookie(),
    });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ ok: true });
  });

  it("400s without an id", async () => {
    const { repos } = seed();
    const app = buildApp({ repos });
    const res = await app.inject({
      method: "DELETE",
      url: "/api/admin/categories",
      cookies: await adminCookie(),
    });
    expect(res.statusCode).toBe(400);
  });
});
