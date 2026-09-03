import Fastify from "fastify";
import fastifyCookie from "@fastify/cookie";
import { describe, expect, it, vi, afterEach } from "vitest";
import authPlugin, {
  STAFF_COOKIE,
  STAFF_ROLES,
  canAccess,
  rolesForPath,
  staffToken,
  verifyStaffToken,
  setStaffCookie,
} from "../../src/plugins/auth.js";
import { seed } from "../helpers/fakeRepos.js";

afterEach(() => vi.useRealTimers());

describe("staff token", () => {
  it("round-trips claims and rejects tampering", async () => {
    const token = staffToken("staff-1", "outlet-1", "admin");
    expect(await verifyStaffToken(token)).toMatchObject({
      staffId: "staff-1",
      outletId: "outlet-1",
      role: "admin",
    });
    const parts = token.split(".");
    expect(
      await verifyStaffToken(`${parts[0]}.${parts[1]}.${parts[2]}.waiter.${parts[4]}.${parts[5]}`),
    ).toBeNull();
    expect(
      await verifyStaffToken(`${parts.slice(0, -1).join(".")}.0`.replace(/\.0$/, ".bad")),
    ).toBeNull();
  });

  it("expires and supports every role", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-09-04T10:00:00Z"));
    for (const role of STAFF_ROLES)
      expect((await verifyStaffToken(staffToken("s", "o", role)))?.role).toBe(role);
    const token = staffToken("s", "o", "admin");
    vi.setSystemTime(new Date("2026-09-04T23:00:01Z"));
    expect(await verifyStaffToken(token)).toBeNull();
  });
});

describe("auth hook", () => {
  it("requires a matching active staff row and outlet", async () => {
    const { repos, data, ids } = seed();
    const app = Fastify();
    app.register(fastifyCookie);
    app.decorate("repos", repos);
    app.register(authPlugin);
    app.get("/api/admin/me", async (request) => ({ role: request.staffRole }));
    const row = data.staff[0];
    const token = staffToken(row.id as string, ids.outlet, "admin");
    expect(
      (await app.inject({ url: "/api/admin/me", headers: { cookie: `${STAFF_COOKIE}=${token}` } }))
        .statusCode,
    ).toBe(200);
    data.staff[0].active = false;
    expect(
      (await app.inject({ url: "/api/admin/me", headers: { cookie: `${STAFF_COOKIE}=${token}` } }))
        .statusCode,
    ).toBe(401);
    await app.close();
  });
});

it("matches protected paths and cookie name", () => {
  expect(rolesForPath("/api/admin/me")).toEqual([...STAFF_ROLES]);
  expect(canAccess("/api/admin", "waiter")).toBe(false);
  expect(canAccess("/api/session", null)).toBe(true);
  expect(STAFF_COOKIE).toBe("narada_staff");
  expect(setStaffCookie).toBeTypeOf("function");
});
