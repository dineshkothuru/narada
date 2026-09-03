import { describe, expect, it } from "vitest";
import { createStaff, deleteStaff, listStaff, patchStaff } from "../../src/services/adminStaff.js";
import { seed } from "../helpers/fakeRepos.js";

describe("createStaff", () => {
  it("creates a staff member with a fresh pin", async () => {
    const { data, repos } = seed();
    const result = await createStaff(repos, { name: "New Waiter", role: "waiter", pin: "2001" });
    expect(result).toEqual({ ok: true });
    expect(data.staff.some((s) => s.name === "New Waiter" && s.pin === "2001")).toBe(true);
  });

  it("409s when the pin matches the owner's admin_pin", async () => {
    const { repos } = seed();
    await expect(
      createStaff(repos, { name: "New Waiter", role: "waiter", pin: "0000" }),
    ).rejects.toMatchObject({ statusCode: 409 });
  });

  it("409s when the pin is already used by another staff member", async () => {
    const { repos } = seed();
    await expect(
      createStaff(repos, { name: "Dup", role: "waiter", pin: "1002" }),
    ).rejects.toMatchObject({ statusCode: 409 });
  });

  it("400s with an invalid role", async () => {
    const { repos } = seed();
    await expect(
      createStaff(repos, { name: "X", role: "manager", pin: "1234" }),
    ).rejects.toMatchObject({ statusCode: 400 });
  });
});

describe("patchStaff", () => {
  it("toggles active", async () => {
    const { data, repos } = seed();
    const staffId = data.staff[0].id as string;
    const result = await patchStaff(repos, { staffId, active: false });
    expect(result).toEqual({ ok: true });
    expect(data.staff.find((s) => s.id === staffId)?.active).toBe(false);
  });

  it("400s without staffId", async () => {
    const { repos } = seed();
    // @ts-expect-error missing staffId on purpose
    await expect(patchStaff(repos, { active: true })).rejects.toMatchObject({ statusCode: 400 });
  });
});

describe("deleteStaff / listStaff", () => {
  it("removes a staff member", async () => {
    const { data, repos } = seed();
    const staffId = data.staff[0].id as string;
    const result = await deleteStaff(repos, staffId);
    expect(result).toEqual({ ok: true });
    expect(data.staff.find((s) => s.id === staffId)).toBeUndefined();
  });

  it("lists all staff", async () => {
    const { repos } = seed();
    const result = await listStaff(repos);
    expect(result.staff.length).toBe(5);
  });
});
