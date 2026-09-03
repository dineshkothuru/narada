import { describe, expect, it } from "vitest";
import { buildApp } from "../../../src/app.js";
import { STAFF_COOKIE, staffToken } from "../../../src/plugins/auth.js";
import { seed } from "../../helpers/fakeRepos.js";

describe("scoped /api/admin/staff", () => {
  it("creates and lists staff without hashes", async () => {
    const { repos, ids } = seed();
    const app = buildApp({ repos });
    const admin = (await repos.staff.listByOutlet(ids.outlet))[0];
    const cookies = { [STAFF_COOKIE]: staffToken(admin.id, ids.outlet, "admin") };
    const created = await app.inject({
      method: "POST",
      url: "/api/admin/staff",
      cookies,
      payload: {
        username: "new.waiter",
        firstName: "New",
        lastName: "Waiter",
        role: "waiter",
        password: "new-waiter-password",
      },
    });
    expect(created.statusCode).toBe(200);
    const listed = await app.inject({ url: "/api/admin/staff", cookies });
    expect(listed.statusCode).toBe(200);
    expect(
      listed.json().staff.find((row: { username: string }) => row.username === "new.waiter"),
    ).not.toHaveProperty("password_hash");
    await app.close();
  });

  it("rejects self deletion and final admin deactivation", async () => {
    const { repos, ids } = seed();
    const app = buildApp({ repos });
    const admin = (await repos.staff.listByOutlet(ids.outlet))[0];
    const cookies = { [STAFF_COOKIE]: staffToken(admin.id, ids.outlet, "admin") };
    const response = await app.inject({
      method: "PATCH",
      url: "/api/admin/staff",
      cookies,
      payload: { staffId: admin.id, active: false },
    });
    expect(response.statusCode).toBe(409);
    await app.close();
  });
});
