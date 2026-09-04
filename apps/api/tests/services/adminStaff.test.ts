import { describe, expect, it } from "vitest";
import { createStaff, deleteStaff, listStaff, patchStaff } from "../../src/services/adminStaff.js";
import { seed } from "../helpers/fakeRepos.js";
import type { StaffSession } from "../../src/plugins/auth.js";

const adminSession = (
  data: { staff: Record<string, unknown>[] },
  outletId: string,
): StaffSession => {
  const row = data.staff.find((staff) => staff.role === "admin")!;
  return {
    staffId: row.id as string,
    outletId,
    role: "admin",
    expiresAt: Date.now() + 1_000,
    displayName: "Owner",
    staff: {
      id: row.id as string,
      username: row.username as string,
      firstName: row.first_name as string,
      lastName: null,
      displayName: "Owner",
    },
    outlet: { id: outletId, name: "Spice Garden", slug: "demo-spice-garden" },
  };
};

describe("scoped staff CRUD", () => {
  it("normalizes fields and never returns hashes", async () => {
    const { data, repos, ids } = seed();
    const session = adminSession(data, ids.outlet);
    const created = await createStaff(
      repos,
      {
        username: "  new.waiter ",
        firstName: "  New  ",
        lastName: " Waiter ",
        role: "waiter",
        password: "new-waiter-password",
      },
      session,
    );
    expect(created.staff).toMatchObject({
      username: "new.waiter",
      firstName: "New",
      lastName: "Waiter",
    });
    expect(created.staff).not.toHaveProperty("password_hash");
    expect((await listStaff(repos, session)).staff).toHaveLength(6);
  });

  it("protects self and the final active admin", async () => {
    const { data, repos, ids } = seed();
    const session = adminSession(data, ids.outlet);
    await expect(
      patchStaff(repos, { staffId: session.staffId, active: false }, session),
    ).rejects.toMatchObject({ statusCode: 409 });
    await expect(deleteStaff(repos, session.staffId, session)).rejects.toMatchObject({
      statusCode: 409,
    });
    const waiter = data.staff.find((staff) => staff.role === "waiter")!;
    await expect(
      patchStaff(repos, { staffId: session.staffId, role: "waiter" }, session),
    ).rejects.toMatchObject({ statusCode: 409 });
    await expect(deleteStaff(repos, waiter.id as string, session)).resolves.toEqual({ ok: true });
  });
});
