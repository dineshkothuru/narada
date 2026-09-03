import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  canAccess,
  rolesForPath,
  roleToken,
  verifyToken,
  type StaffRole,
} from "@/lib/admin-auth";

describe("rolesForPath", () => {
  it("gates the owner's screens to admin alone", () => {
    expect(rolesForPath("/admin/menu")).toEqual(["admin"]);
    expect(rolesForPath("/api/admin/settings")).toEqual(["admin"]);
  });

  it("lets the longest matching rule win, whatever the table's key order", () => {
    // /api/admin/me must keep its own wider rule despite sitting under /api/admin
    expect(rolesForPath("/api/admin/me")).toEqual([
      "admin",
      "kitchen",
      "waiter",
      "reception",
    ]);
  });

  it("matches on whole segments, so /admin never claims a longer word", () => {
    expect(rolesForPath("/administrator")).toBeNull();
    expect(rolesForPath("/admin")).toEqual(["admin"]);
  });

  it("covers nested routes under a gated prefix", () => {
    expect(rolesForPath("/api/waiter/tips")).toEqual(["admin", "waiter"]);
  });

  it("returns null for paths the middleware does not gate", () => {
    expect(rolesForPath("/t/table-3")).toBeNull();
  });
});

describe("canAccess", () => {
  const cases: [string, StaffRole, boolean][] = [
    ["/admin", "admin", true],
    ["/admin", "kitchen", false],
    ["/admin/users", "waiter", false],
    ["/kitchen", "kitchen", true],
    ["/kitchen", "waiter", false],
    ["/waiter", "waiter", true],
    ["/waiter", "reception", false],
    ["/floor", "reception", true],
    ["/floor", "kitchen", false],
    // the owner can open every staff screen
    ["/kitchen", "admin", true],
    ["/floor", "admin", true],
    ["/api/waiter/tips", "waiter", true],
    ["/api/waiter/tips", "kitchen", false],
  ];

  it.each(cases)("%s is %s for %s", (path, role, allowed) => {
    expect(canAccess(path, role)).toBe(allowed);
  });

  it("refuses everyone who is not signed in", () => {
    expect(canAccess("/kitchen", null)).toBe(false);
    expect(canAccess("/t/table-3", null)).toBe(false);
  });

  it("allows any signed-in role through an ungated path", () => {
    expect(canAccess("/t/table-3", "kitchen")).toBe(true);
  });
});

describe("staff tokens", () => {
  beforeEach(() => {
    process.env.SUPABASE_SERVICE_ROLE_KEY = "test-secret";
  });

  it("round-trips the role it was minted for", async () => {
    for (const role of ["admin", "kitchen", "waiter", "reception"] as StaffRole[]) {
      expect(await verifyToken(await roleToken(role))).toBe(role);
    }
  });

  it("rejects a missing token", async () => {
    expect(await verifyToken(undefined)).toBeNull();
    expect(await verifyToken("")).toBeNull();
  });

  it("rejects a token whose role was swapped for a better one", async () => {
    const token = await roleToken("kitchen");
    const [, exp, hash] = token.split(".");
    expect(await verifyToken(`admin.${exp}.${hash}`)).toBeNull();
  });

  it("rejects a tampered signature", async () => {
    const [role, exp] = (await roleToken("admin")).split(".");
    expect(await verifyToken(`${role}.${exp}.${"0".repeat(64)}`)).toBeNull();
  });

  it("rejects an expiry pushed into the future without re-signing", async () => {
    const [role, , hash] = (await roleToken("admin")).split(".");
    const farOff = Date.now() + 90 * 24 * 60 * 60 * 1000;
    expect(await verifyToken(`${role}.${farOff}.${hash}`)).toBeNull();
  });

  it("rejects an unknown role", async () => {
    expect(await verifyToken(`owner.${Date.now() + 10_000}.${"a".repeat(64)}`)).toBeNull();
  });

  it("rejects malformed tokens instead of throwing", async () => {
    expect(await verifyToken("garbage")).toBeNull();
    expect(await verifyToken("admin.notanumber.abc")).toBeNull();
  });

  it("stops working once the 12h shift token expires", async () => {
    vi.useFakeTimers();
    try {
      vi.setSystemTime(new Date("2026-09-03T09:00:00.000Z"));
      const token = await roleToken("admin");
      expect(await verifyToken(token)).toBe("admin");

      vi.setSystemTime(new Date("2026-09-03T20:59:00.000Z")); // 11h59m later
      expect(await verifyToken(token)).toBe("admin");

      vi.setSystemTime(new Date("2026-09-03T21:01:00.000Z")); // just past 12h
      expect(await verifyToken(token)).toBeNull();
    } finally {
      vi.useRealTimers();
    }
  });

  it("does not honour a token signed with a different secret", async () => {
    const token = await roleToken("admin");
    process.env.SUPABASE_SERVICE_ROLE_KEY = "rotated-secret";
    expect(await verifyToken(token)).toBeNull();
  });
});
