import { afterEach, describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { createTestDb } from "../helpers/pglite.js";
import { buildApp } from "../../src/app.js";

const migration = readFileSync(
  fileURLToPath(new URL("../../../../docs/migrate-customer-auth.sql", import.meta.url)),
  "utf8",
);

describe("customer-auth migration", () => {
  const dbs: Awaited<ReturnType<typeof createTestDb>>[] = [];
  afterEach(async () => Promise.all(dbs.splice(0).map((db) => db.destroy())));

  it("is repeatable and leaves old sessions nullable", async () => {
    const testDb = await createTestDb({ seed: false });
    dbs.push(testDb);
    await testDb.raw.exec(migration);
    await testDb.raw.exec(migration);
    await testDb.raw.exec(
      "insert into customers(phone,first_name,password_hash) values ('+919876543210','Demo','hash')",
    );
    expect((await testDb.raw.query("select phone from customers")).rows).toEqual([
      { phone: "+919876543210" },
    ]);
    expect(
      (
        await testDb.raw.query(
          "select column_name from information_schema.columns where table_name='sessions' and column_name='customer_id'",
        )
      ).rows,
    ).toEqual([{ column_name: "customer_id" }]);
  });

  it("loads the local demo account from the seed", async () => {
    const testDb = await createTestDb();
    dbs.push(testDb);
    const login = await buildApp({ repos: testDb.repos }).inject({
      method: "POST",
      url: "/api/auth/customer/login",
      payload: { phone: "+91 98765 43210", password: "customer-demo-password" },
    });
    expect(login.statusCode).toBe(200);
    expect(login.json().customer).toMatchObject({
      phone: "+919876543210",
      firstName: "Demo",
      lastName: "Customer",
    });
  });
});
