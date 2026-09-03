import { describe, expect, it } from "vitest";
import { buildApp } from "../../../src/app.js";
import { ADMIN_COOKIE, roleToken } from "../../../src/plugins/auth.js";
import { seed } from "../../helpers/fakeRepos.js";

async function adminCookie() {
  return { [ADMIN_COOKIE]: await roleToken("admin") };
}

describe("GET /api/admin/staff", () => {
  it("lists staff", async () => {
    const { repos } = seed();
    const app = buildApp({ repos });
    const res = await app.inject({ url: "/api/admin/staff", cookies: await adminCookie() });
    expect(res.statusCode).toBe(200);
    expect(res.json().staff.length).toBe(5);
  });
});

describe("POST /api/admin/staff", () => {
  it("creates a staff member", async () => {
    const { repos } = seed();
    const app = buildApp({ repos });
    const res = await app.inject({
      method: "POST",
      url: "/api/admin/staff",
      cookies: await adminCookie(),
      payload: { name: "New Waiter", role: "waiter", pin: "2001" },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ ok: true });
  });

  it("409s on a duplicate pin", async () => {
    const { repos } = seed();
    const app = buildApp({ repos });
    const res = await app.inject({
      method: "POST",
      url: "/api/admin/staff",
      cookies: await adminCookie(),
      payload: { name: "Dup", role: "waiter", pin: "1002" },
    });
    expect(res.statusCode).toBe(409);
  });
});

describe("PATCH /api/admin/staff", () => {
  it("toggles active", async () => {
    const { data, repos } = seed();
    const app = buildApp({ repos });
    const staffId = data.staff[0].id as string;
    const res = await app.inject({
      method: "PATCH",
      url: "/api/admin/staff",
      cookies: await adminCookie(),
      payload: { staffId, active: false },
    });
    expect(res.statusCode).toBe(200);
  });
});

describe("DELETE /api/admin/staff", () => {
  it("removes a staff member", async () => {
    const { data, repos } = seed();
    const app = buildApp({ repos });
    const staffId = data.staff[0].id as string;
    const res = await app.inject({
      method: "DELETE",
      url: `/api/admin/staff?id=${staffId}`,
      cookies: await adminCookie(),
    });
    expect(res.statusCode).toBe(200);
  });
});
