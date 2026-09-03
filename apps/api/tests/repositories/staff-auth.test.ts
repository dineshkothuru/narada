import { afterEach, describe, expect, it } from "vitest";
import { createTestDb, type TestDb } from "../helpers/pglite.js";

let testDb: TestDb | undefined;
afterEach(async () => {
  await testDb?.destroy();
  testDb = undefined;
});

describe("staff admin mutation locking", () => {
  it("protects the final admin across scoped update and delete", async () => {
    testDb = await createTestDb();
    const outlet = (await testDb.repos.outlets.findFirst())!;
    const owner = (await testDb.repos.staff.findByUsername(outlet.id, "owner"))!;
    await expect(
      testDb.repos.staff.updateScoped(owner.id, outlet.id, { active: false }),
    ).rejects.toThrow(/final active admin/);
    const second = await testDb.repos.staff.create({
      outlet_id: outlet.id,
      username: "owner2",
      first_name: "Owner",
      last_name: null,
      role: "admin",
      password_hash: owner.password_hash,
    });
    await expect(
      testDb.repos.staff.updateScoped(owner.id, outlet.id, { active: false }),
    ).resolves.toBeTruthy();
    await expect(testDb.repos.staff.removeScoped(owner.id, outlet.id)).resolves.toBe(true);
    await expect(testDb.repos.staff.removeScoped(second.id, outlet.id)).rejects.toThrow(
      /final active admin/,
    );
  });
});
