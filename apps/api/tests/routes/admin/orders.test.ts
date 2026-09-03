import { describe, expect, it } from "vitest";
import { buildApp } from "../../../src/app.js";
import { ADMIN_COOKIE, roleToken } from "../../../src/plugins/auth.js";
import { seed } from "../../helpers/fakeRepos.js";

describe("GET /api/admin/orders", () => {
  it("returns orders and stats", async () => {
    const { repos } = seed();
    const app = buildApp({ repos });
    const res = await app.inject({
      url: "/api/admin/orders?range=all",
      cookies: { [ADMIN_COOKIE]: await roleToken("admin") },
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.orders).toEqual([]);
    expect(body.stats.orders).toBe(0);
  });

  it("401s without a cookie", async () => {
    const { repos } = seed();
    const app = buildApp({ repos });
    const res = await app.inject({ url: "/api/admin/orders" });
    expect(res.statusCode).toBe(401);
  });
});
