import { describe, expect, it } from "vitest";
import { buildApp } from "../../../src/app.js";
import { ADMIN_COOKIE, roleToken } from "../../../src/plugins/auth.js";
import { seed } from "../../helpers/fakeRepos.js";

describe("GET /api/admin/me", () => {
  it("returns the role for any signed-in staff member", async () => {
    const { repos } = seed();
    const app = buildApp({ repos });
    const res = await app.inject({
      url: "/api/admin/me",
      cookies: { [ADMIN_COOKIE]: await roleToken("kitchen") },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ role: "kitchen" });
  });

  it("401s without a cookie", async () => {
    const { repos } = seed();
    const app = buildApp({ repos });
    const res = await app.inject({ url: "/api/admin/me" });
    expect(res.statusCode).toBe(401);
  });
});
