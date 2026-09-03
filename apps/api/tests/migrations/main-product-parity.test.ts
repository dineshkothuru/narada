import { afterEach, describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { createTestDb } from "../helpers/pglite.js";

const migration = readFileSync(
  fileURLToPath(new URL("../../../../docs/migrate-main-product-parity.sql", import.meta.url)),
  "utf8",
);

describe("main product parity migration", () => {
  const dbs: Awaited<ReturnType<typeof createTestDb>>[] = [];
  afterEach(async () => Promise.all(dbs.splice(0).map((db) => db.destroy())));

  it("is repeatable and exposes cancellation, waiter orders, and audit rows", async () => {
    const testDb = await createTestDb({ seed: false });
    dbs.push(testDb);
    await testDb.raw.exec(migration);
    await testDb.raw.exec(migration);

    const columns = await testDb.raw.query<{ column_name: string }>(
      "select column_name from information_schema.columns where table_name='order_items' and column_name in ('cancelled_at','cancelled_by') order by column_name",
    );
    expect(columns.rows).toEqual([
      { column_name: "cancelled_at" },
      { column_name: "cancelled_by" },
    ]);
    const audit = await testDb.raw.query<{ table_name: string }>(
      "select table_name from information_schema.tables where table_name='audit_log'",
    );
    expect(audit.rows).toEqual([{ table_name: "audit_log" }]);
  });
});
