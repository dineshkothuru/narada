import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { OutletSlugConflictError } from "../../src/repositories/outlets.js";
import { createTestDb, type TestDb } from "../helpers/pglite.js";

let t: TestDb;

beforeEach(async () => {
  t = await createTestDb();
});

afterEach(async () => {
  await t.destroy();
});

describe("outlet slug updates", () => {
  it("converts the database unique constraint to a slug conflict", async () => {
    const first = await t.repos.outlets.findFirst();
    const second = await t.db
      .insertInto("outlets")
      .values({ name: "Other Garden", slug: "other-garden" })
      .returning("id")
      .executeTakeFirstOrThrow();

    await expect(
      t.repos.outlets.update(first!.id, { slug: "other-garden" }),
    ).rejects.toBeInstanceOf(OutletSlugConflictError);
    expect((await t.repos.outlets.findById(first!.id))?.slug).not.toBe("other-garden");
    expect(second.id).toBeDefined();
  });
});
