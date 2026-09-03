import { describe, expect, it } from "vitest";
import { buildApp } from "../../../src/app.js";
import { STAFF_COOKIE, staffToken } from "../../../src/plugins/auth.js";
import { seed } from "../../helpers/fakeRepos.js";

describe("GET /api/admin/me", () => {
  it("returns account and outlet identity", async () => {
    const { repos, ids } = seed();
    const app = buildApp({ repos });
    const response = await app.inject({
      url: "/api/admin/me",
      cookies: { [STAFF_COOKIE]: staffToken("missing", ids.outlet, "admin") },
    });
    expect(response.statusCode).toBe(401);
    const row = (await repos.staff.listByOutlet(ids.outlet))[0];
    const ok = await app.inject({
      url: "/api/admin/me",
      cookies: { [STAFF_COOKIE]: staffToken(row.id, ids.outlet, "admin") },
    });
    expect(ok.statusCode).toBe(200);
    expect(ok.json()).toMatchObject({
      role: "admin",
      staff: { id: row.id, username: "owner" },
      outlet: { id: ids.outlet },
    });
    await app.close();
  });

  it("revokes a token when the staff row is disabled", async () => {
    const { data, repos, ids } = seed();
    const app = buildApp({ repos });
    const row = data.staff[0];
    const token = staffToken(row.id as string, ids.outlet, "admin");
    data.staff[0].active = false;
    const response = await app.inject({ url: "/api/admin/me", cookies: { [STAFF_COOKIE]: token } });
    expect(response.statusCode).toBe(401);
    await app.close();
  });
});
