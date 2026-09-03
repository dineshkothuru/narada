import { describe, expect, it } from "vitest";
import { login } from "../../src/services/staffAuth.js";
import { seed } from "../helpers/fakeRepos.js";

describe("login", () => {
  it("logs a staff member in with their correct PIN", async () => {
    const { repos } = seed();
    const result = await login(repos, "1002");
    expect(result).toEqual({ role: "waiter", name: "waiter one" });
  });

  it("logs the owner in with the outlet admin_pin", async () => {
    const { repos } = seed();
    const result = await login(repos, "0000");
    expect(result).toEqual({ role: "admin", name: "Owner" });
  });

  it("rejects a wrong pin", async () => {
    const { repos } = seed();
    expect(await login(repos, "9999")).toBeNull();
  });

  it("ignores an inactive staff member's pin", async () => {
    const { data, repos } = seed();
    const waiter = data.staff.find((s) => s.role === "waiter")!;
    waiter.active = false;
    expect(await login(repos, "1002")).toBeNull();
  });

  it("400s without a pin", async () => {
    const { repos } = seed();
    await expect(login(repos, "")).rejects.toMatchObject({ statusCode: 400 });
  });
});
