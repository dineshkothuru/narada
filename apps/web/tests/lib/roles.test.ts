// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { canAccess, rolesForPath, ROLE_ACCESS } from "../../src/lib/roles";

describe("roles matrix", () => {
  it("mirrors the legacy admin-auth ROLE_ACCESS shape", () => {
    expect(ROLE_ACCESS["/admin"]).toEqual(["admin"]);
    expect(ROLE_ACCESS["/kitchen"]).toEqual(["admin", "kitchen"]);
    expect(ROLE_ACCESS["/waiter"]).toEqual(["admin", "waiter"]);
    expect(ROLE_ACCESS["/floor"]).toEqual(["admin", "waiter", "reception", "cashier"]);
    expect(ROLE_ACCESS["/counter"]).toEqual(["admin", "cashier"]);
  });

  it("longest matching prefix wins and is segment-aware", () => {
    expect(rolesForPath("/admin/orders")).toEqual(["admin"]);
    expect(rolesForPath("/administrator")).toBeNull();
    expect(rolesForPath("/unknown")).toBeNull();
  });

  it("canAccess denies a null role", () => {
    expect(canAccess("/kitchen", null)).toBe(false);
  });

  it("canAccess allows a role listed for the path", () => {
    expect(canAccess("/kitchen", "kitchen")).toBe(true);
    expect(canAccess("/kitchen", "admin")).toBe(true);
    expect(canAccess("/kitchen", "waiter")).toBe(false);
  });

  it("canAccess allows any role for an unlisted path", () => {
    expect(canAccess("/t/table-1", "waiter")).toBe(true);
  });
});
