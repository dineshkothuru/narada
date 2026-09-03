import { describe, expect, it } from "vitest";
import { buildApp } from "../../../src/app.js";
import { STAFF_COOKIE } from "../../../src/plugins/auth.js";
import { seed } from "../../helpers/fakeRepos.js";

describe("staff login routes", () => {
  it("logs in through the outlet URL and derives the role", async () => {
    const { repos, ids } = seed();
    const app = buildApp({ repos });
    const login = await app.inject({
      method: "POST",
      url: "/api/outlet/demo-spice-garden/login",
      payload: { username: "OWNER", password: "owner-demo-password" },
    });
    expect(login.statusCode).toBe(200);
    expect(login.json()).toMatchObject({
      role: "admin",
      staff: { username: "owner" },
      outlet: { id: ids.outlet },
    });
    expect(login.cookies.find((cookie) => cookie.name === STAFF_COOKIE)).toBeTruthy();
    await app.close();
  });

  it("returns a generic failure for malformed credentials", async () => {
    const { repos } = seed();
    const app = buildApp({ repos });
    const response = await app.inject({
      method: "POST",
      url: "/api/outlet/demo-spice-garden/login",
      payload: { username: "owner", password: "short" },
    });
    expect(response.statusCode).toBe(401);
    expect(response.json()).toEqual({ error: "invalid credentials" });
    await app.close();
  });

  it("logs in from an outlet URL without accepting an outlet selector", async () => {
    const { repos, ids } = seed();
    const app = buildApp({ repos });
    const response = await app.inject({
      method: "POST",
      url: "/api/outlet/demo-spice-garden/login",
      payload: { username: "OWNER", password: "owner-demo-password", outletId: "wrong" },
    });
    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({ role: "admin", outlet: { id: ids.outlet } });
    expect(response.cookies.find((cookie) => cookie.name === STAFF_COOKIE)).toBeTruthy();
    await app.close();
  });

  it("uses one generic failure for unknown outlet or bad credentials", async () => {
    const { repos } = seed();
    const app = buildApp({ repos });
    const response = await app.inject({
      method: "POST",
      url: "/api/outlet/no-such-outlet/login",
      payload: { username: "owner", password: "owner-demo-password" },
    });
    expect(response.statusCode).toBe(401);
    expect(response.json()).toEqual({ error: "invalid credentials" });
    await app.close();
  });

  it("logs out through the staff auth endpoint", async () => {
    const { repos } = seed();
    const app = buildApp({ repos });
    const response = await app.inject({ method: "DELETE", url: "/api/auth/staff/logout" });
    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ ok: true });
    expect(response.cookies.find((cookie) => cookie.name === STAFF_COOKIE)?.value).toBe("");
    await app.close();
  });
});
