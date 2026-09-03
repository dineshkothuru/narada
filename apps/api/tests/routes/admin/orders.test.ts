import { describe, expect, it } from "vitest";
import { buildApp } from "../../../src/app.js";
import { seed } from "../../helpers/fakeRepos.js";
import { staffCookie } from "../../helpers/staffCookie.js";

describe("GET /api/admin/orders", () => {
  it("returns orders and stats", async () => {
    const { data, repos } = seed();
    const app = buildApp({ repos });
    const res = await app.inject({
      url: "/api/admin/orders?range=all",
      cookies: staffCookie(data, "admin"),
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
