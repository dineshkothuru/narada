import { describe, expect, it } from "vitest";
import { buildApp } from "../../../src/app.js";
import { ADMIN_COOKIE } from "../../../src/plugins/auth.js";
import { seed } from "../../helpers/fakeRepos.js";

describe("POST /api/admin/login", () => {
  it("logs in with a valid pin and sets the cookie", async () => {
    const { repos } = seed();
    const app = buildApp({ repos });
    const res = await app.inject({
      method: "POST",
      url: "/api/admin/login",
      payload: { pin: "0000" },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toMatchObject({ ok: true, role: "admin" });
    const cookie = res.cookies.find((c) => c.name === ADMIN_COOKIE);
    expect(cookie).toBeTruthy();
  });

  it("401s on a wrong pin", async () => {
    const { repos } = seed();
    const app = buildApp({ repos });
    const res = await app.inject({
      method: "POST",
      url: "/api/admin/login",
      payload: { pin: "9999" },
    });
    expect(res.statusCode).toBe(401);
  });

  it("400s without a pin", async () => {
    const { repos } = seed();
    const app = buildApp({ repos });
    const res = await app.inject({ method: "POST", url: "/api/admin/login", payload: {} });
    expect(res.statusCode).toBe(400);
  });
});

describe("DELETE /api/admin/login", () => {
  it("clears the cookie", async () => {
    const { repos } = seed();
    const app = buildApp({ repos });
    const res = await app.inject({ method: "DELETE", url: "/api/admin/login" });
    expect(res.statusCode).toBe(200);
    const cookie = res.cookies.find((c) => c.name === ADMIN_COOKIE);
    // clearCookie sends an expired cookie rather than omitting it
    expect(cookie?.value === "" || cookie === undefined).toBe(true);
  });
});
