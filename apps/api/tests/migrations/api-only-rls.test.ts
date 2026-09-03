import { afterEach, describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { createTestDb } from "../helpers/pglite.js";

const migration = readFileSync(
  fileURLToPath(new URL("../../../../docs/migrate-api-only-rls.sql", import.meta.url)),
  "utf8",
);

describe("API-only RLS migration", () => {
  const dbs: Awaited<ReturnType<typeof createTestDb>>[] = [];
  afterEach(async () => Promise.all(dbs.splice(0).map((db) => db.destroy())));

  it("is repeatable and locks down the audit log", async () => {
    const testDb = await createTestDb({ seed: false });
    dbs.push(testDb);
    await testDb.raw.exec("drop role anon; drop role authenticated;");
    await testDb.raw.exec(migration);
    await testDb.raw.exec(migration);

    const rls = await testDb.raw.query<{ relrowsecurity: boolean }>(
      "select relrowsecurity from pg_class where oid = 'audit_log'::regclass",
    );
    expect(rls.rows).toEqual([{ relrowsecurity: true }]);

    const policies = await testDb.raw.query(
      "select * from pg_policies where tablename in ('outlets','tables','menu_categories','menu_items')",
    );
    expect(policies.rows).toEqual([]);
  });
});
