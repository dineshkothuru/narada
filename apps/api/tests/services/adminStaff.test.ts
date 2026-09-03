import { describe, expect, it } from "vitest";
import { env } from "../../src/env.js";
import {
  createStaff,
  deleteStaff,
  ensureAdminBootstrap,
  listStaff,
  patchStaff,
} from "../../src/services/adminStaff.js";
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

describe("bootstrap", () => {
  it("targets the configured active outlet and repairs malformed hashes", async () => {
    const { data, repos, ids } = seed();
    data.staff.splice(0, data.staff.length, {
      id: "legacy",
      outlet_id: ids.outlet,
      username: "owner",
      first_name: "Owner",
      last_name: null,
      role: "admin",
      password_hash: "bad",
      active: true,
    });
    const previous = {
      username: env.ADMIN_BOOTSTRAP_USERNAME,
      first: env.ADMIN_BOOTSTRAP_FIRST_NAME,
      last: env.ADMIN_BOOTSTRAP_LAST_NAME,
      password: env.ADMIN_BOOTSTRAP_PASSWORD,
      slug: env.ADMIN_BOOTSTRAP_OUTLET_SLUG,
    };
    Object.assign(env, {
      ADMIN_BOOTSTRAP_USERNAME: "owner",
      ADMIN_BOOTSTRAP_FIRST_NAME: "Owner",
      ADMIN_BOOTSTRAP_LAST_NAME: "",
      ADMIN_BOOTSTRAP_PASSWORD: "owner-demo-password",
      ADMIN_BOOTSTRAP_OUTLET_SLUG: "",
    });
    try {
      await ensureAdminBootstrap(repos);
      expect(data.staff[0].password_hash).toMatch(/^scrypt\$/);
    } finally {
      Object.assign(env, {
        ADMIN_BOOTSTRAP_USERNAME: previous.username,
        ADMIN_BOOTSTRAP_FIRST_NAME: previous.first,
        ADMIN_BOOTSTRAP_LAST_NAME: previous.last,
        ADMIN_BOOTSTRAP_PASSWORD: previous.password,
        ADMIN_BOOTSTRAP_OUTLET_SLUG: previous.slug,
      });
    }
  });

  it("does not treat an incomplete legacy admin as login-ready", async () => {
    const { data, repos } = seed();
    const owner = data.staff[0];
    owner.username = null;
    owner.first_name = null;
    const previous = {
      username: env.ADMIN_BOOTSTRAP_USERNAME,
      first: env.ADMIN_BOOTSTRAP_FIRST_NAME,
      last: env.ADMIN_BOOTSTRAP_LAST_NAME,
      password: env.ADMIN_BOOTSTRAP_PASSWORD,
      slug: env.ADMIN_BOOTSTRAP_OUTLET_SLUG,
    };
    Object.assign(env, {
      ADMIN_BOOTSTRAP_USERNAME: "owner",
      ADMIN_BOOTSTRAP_FIRST_NAME: "Owner",
      ADMIN_BOOTSTRAP_LAST_NAME: "",
      ADMIN_BOOTSTRAP_PASSWORD: "owner-demo-password",
      ADMIN_BOOTSTRAP_OUTLET_SLUG: "",
    });
    try {
      await ensureAdminBootstrap(repos);
      expect(owner.username).toBe("owner");
      expect(owner.first_name).toBe("Owner");
    } finally {
      Object.assign(env, {
        ADMIN_BOOTSTRAP_USERNAME: previous.username,
        ADMIN_BOOTSTRAP_FIRST_NAME: previous.first,
        ADMIN_BOOTSTRAP_LAST_NAME: previous.last,
        ADMIN_BOOTSTRAP_PASSWORD: previous.password,
        ADMIN_BOOTSTRAP_OUTLET_SLUG: previous.slug,
      });
    }
  });
});
