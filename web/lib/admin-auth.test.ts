import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ROLE_ACCESS, roleToken, verifyToken, type StaffRole } from "./admin-auth";

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-01-01T00:00:00Z"));
});

afterEach(() => {
  vi.useRealTimers();
});

describe("roleToken / verifyToken", () => {
  const roles: StaffRole[] = ["admin", "kitchen", "waiter", "reception"];

  for (const role of roles) {
    it(`round-trips role "${role}"`, async () => {
      const token = await roleToken(role);
      expect(await verifyToken(token)).toBe(role);
    });
  }

  it("rejects a tampered hash", async () => {
    const token = await roleToken("admin");
    const [r, exp] = token.split(".");
    const tampered = `${r}.${exp}.deadbeef`;
    expect(await verifyToken(tampered)).toBeNull();
  });

  it("rejects an expired token", async () => {
    const token = await roleToken("waiter");
    vi.setSystemTime(new Date("2026-01-01T00:00:00Z").getTime() + 12 * 60 * 60 * 1000 + 1000);
    expect(await verifyToken(token)).toBeNull();
  });

  it("rejects an unknown role", async () => {
    const exp = Date.now() + 1000;
    expect(await verifyToken(`superadmin.${exp}.abc123`)).toBeNull();
  });

  it("rejects undefined token", async () => {
    expect(await verifyToken(undefined)).toBeNull();
  });
});

describe("ROLE_ACCESS", () => {
  it("maps /floor to include reception", () => {
    expect(ROLE_ACCESS["/floor"]).toContain("reception");
  });

  it("maps /admin to only admin", () => {
    expect(ROLE_ACCESS["/admin"]).toEqual(["admin"]);
  });
});
