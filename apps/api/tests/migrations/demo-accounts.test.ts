import { afterEach, describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { createTestDb } from "../helpers/pglite.js";
import { verifyPassword } from "../../src/lib/password.js";

const migration = readFileSync(
  fileURLToPath(
    new URL(
      "../../../../supabase/migrations/20260904035136_seed_demo_accounts.sql",
      import.meta.url,
    ),
  ),
  "utf8",
);

const staff = [
  ["owner", "admin", "owner-demo-password"],
  ["kitchen", "kitchen", "kitchen-demo-password"],
  ["waiter", "waiter", "waiter-demo-password"],
  ["reception", "reception", "reception-demo-password"],
  ["cashier", "cashier", "cashier-demo-password"],
] as const;
const customerPassword = "customer-demo-password";

describe("demo accounts migration", () => {
  const dbs: Awaited<ReturnType<typeof createTestDb>>[] = [];
  afterEach(async () => Promise.all(dbs.splice(0).map((db) => db.destroy())));

  it("seeds the documented accounts idempotently with verifiable passwords", async () => {
    const testDb = await createTestDb({ seed: false });
    dbs.push(testDb);
    const outlet = await testDb.raw.query<{ id: string }>(
      "insert into outlets (name, slug) values ('Spice Garden', 'demo-spice-garden') returning id",
    );
    await testDb.raw.exec(migration);
    await testDb.raw.exec(migration);

    const rows = await testDb.raw.query<{
      username: string;
      role: string;
      active: boolean;
      password_hash: string;
    }>(
      "select username, role, active, password_hash from staff where outlet_id = $1 order by username",
      [outlet.rows[0].id],
    );
    expect(rows.rows.map(({ username, role, active }) => ({ username, role, active }))).toEqual(
      staff
        .map(([username, role]) => ({ username, role, active: true }))
        .sort((a, b) => a.username.localeCompare(b.username)),
    );
    expect(
      await Promise.all(
        staff.map(([username, , password]) =>
          verifyPassword(
            rows.rows.find((row) => row.username === username)!.password_hash,
            password,
          ),
        ),
      ),
    ).toEqual([true, true, true, true, true]);

    const customers = await testDb.raw.query<{ active: boolean; password_hash: string }>(
      "select active, password_hash from customers where phone = '+919876543210'",
    );
    expect(customers.rows).toHaveLength(1);
    expect(customers.rows[0].active).toBe(true);
    expect(await verifyPassword(customers.rows[0].password_hash, customerPassword)).toBe(true);
  }, 15_000);
});
