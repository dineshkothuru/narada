import { describe, expect, it } from "vitest";
import { login, changePassword } from "../../src/services/staffAuth.js";
import { seed } from "../helpers/fakeRepos.js";

describe("staff login", () => {
  it("uses explicit outlet and canonical username", async () => {
    const { repos, ids } = seed();
    const result = await login(repos, ids.outlet, "OWNER", "owner-demo-password");
    expect(result).toMatchObject({
      role: "admin",
      staff: { username: "owner", firstName: "Owner" },
      outlet: { id: ids.outlet },
    });
    expect(result?.token).toMatch(/^v3\./);
  });

  it("rejects wrong outlet, password, and inactive accounts", async () => {
    const { data, repos, ids } = seed();
    expect(
      await login(repos, "00000000-0000-0000-0000-000000000000", "owner", "owner-demo-password"),
    ).toBeNull();
    expect(await login(repos, ids.outlet, "owner", "wrong-password-1")).toBeNull();
    data.staff[0].active = false;
    expect(await login(repos, ids.outlet, "owner", "owner-demo-password")).toBeNull();
  });
});

describe("staff password change", () => {
  it("requires the current password and rotates the hash", async () => {
    const { data, repos, ids } = seed();
    const row = data.staff[0];
    await expect(
      changePassword(
        repos,
        { staffId: row.id as string },
        "wrong-password-1",
        "new-owner-password",
      ),
    ).rejects.toMatchObject({ statusCode: 401 });
    await expect(
      changePassword(
        repos,
        { staffId: row.id as string },
        "owner-demo-password",
        "new-owner-password",
      ),
    ).resolves.toEqual({ ok: true });
    expect(await login(repos, ids.outlet, "owner", "new-owner-password")).toMatchObject({
      role: "admin",
    });
  });
});
