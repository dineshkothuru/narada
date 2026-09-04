import { afterEach, describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { createTestDb } from "../helpers/pglite.js";

const migration = readFileSync(
  fileURLToPath(
    new URL(
      "../../../../supabase/migrations/20260904060114_remove_outlet_api_keys.sql",
      import.meta.url,
    ),
  ),
  "utf8",
);

describe("remove outlet API keys migration", () => {
  const dbs: Awaited<ReturnType<typeof createTestDb>>[] = [];
  afterEach(async () => Promise.all(dbs.splice(0).map((db) => db.destroy())));

  it("removes both legacy outlet API key columns", async () => {
    const testDb = await createTestDb({ seed: false });
    dbs.push(testDb);
    await testDb.raw.exec(
      "alter table outlets add column gemini_api_key text, add column sarvam_api_key text;",
    );
    await testDb.raw.exec(
      "insert into outlets (name, slug, gemini_api_key, sarvam_api_key) values ('Legacy', 'legacy', 'gemini-secret', 'sarvam-secret');",
    );

    await testDb.raw.exec(migration);
    await testDb.raw.exec(migration);

    expect(
      (
        await testDb.raw.query<{ column_name: string }>(
          "select column_name from information_schema.columns where table_schema = 'public' and table_name = 'outlets' and column_name in ('gemini_api_key', 'sarvam_api_key')",
        )
      ).rows,
    ).toEqual([]);
  });
});
