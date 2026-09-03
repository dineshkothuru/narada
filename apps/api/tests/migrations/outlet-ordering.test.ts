import { afterEach, describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { createTestDb } from "../helpers/pglite.js";

const migration = readFileSync(
  fileURLToPath(new URL("../../../../docs/migrate-outlet-ordering.sql", import.meta.url)),
  "utf8",
);

describe("outlet-ordering migration", () => {
  const dbs: Awaited<ReturnType<typeof createTestDb>>[] = [];
  afterEach(async () => Promise.all(dbs.splice(0).map((db) => db.destroy())));

  it("backfills legacy nulls, preserves false, and is repeatable", async () => {
    const testDb = await createTestDb({ seed: false });
    dbs.push(testDb);
    await testDb.raw.exec("alter table outlets alter column tables_enabled drop not null;");
    await testDb.raw.exec(
      "insert into outlets(name,slug,tables_enabled) values ('Legacy','legacy',null), ('Disabled','disabled',false);",
    );
    const outlet = await testDb.raw.query<{ id: string }>(
      "select id from outlets where slug='legacy'",
    );
    await testDb.raw.query(
      "insert into tables(outlet_id,label,code) values ($1,'Table 1','demo-1')",
      [outlet.rows[0].id],
    );
    await testDb.raw.exec(migration);
    await testDb.raw.exec(migration);
    expect(
      (await testDb.raw.query("select slug,tables_enabled from outlets order by slug")).rows,
    ).toEqual([
      { slug: "disabled", tables_enabled: false },
      { slug: "legacy", tables_enabled: true },
    ]);
    expect((await testDb.raw.query("select table_id,service_type from sessions")).rows).toEqual([]);
  });
});
