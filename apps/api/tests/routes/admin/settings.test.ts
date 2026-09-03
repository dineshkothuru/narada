import { describe, expect, it } from "vitest";
import { buildApp } from "../../../src/app.js";
import { ADMIN_COOKIE, roleToken } from "../../../src/plugins/auth.js";
import { seed } from "../../helpers/fakeRepos.js";

describe("PATCH /api/admin/settings", () => {
  it("updates outlet settings", async () => {
    const { repos, ids } = seed();
    const app = buildApp({ repos });
    const res = await app.inject({
      method: "PATCH",
      url: "/api/admin/settings",
      cookies: { [ADMIN_COOKIE]: await roleToken("admin") },
      payload: { outletId: ids.outlet, service_charge_pct: 10 },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ ok: true });
  });

  it("400s with nothing to update", async () => {
    const { repos, ids } = seed();
    const app = buildApp({ repos });
    const res = await app.inject({
      method: "PATCH",
      url: "/api/admin/settings",
      cookies: { [ADMIN_COOKIE]: await roleToken("admin") },
      payload: { outletId: ids.outlet },
    });
    expect(res.statusCode).toBe(400);
  });
});
