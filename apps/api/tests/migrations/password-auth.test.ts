import { PGlite } from "@electric-sql/pglite";
import { pgcrypto } from "@electric-sql/pglite/contrib/pgcrypto";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { afterEach, describe, expect, it } from "vitest";

const migration = readFileSync(
  fileURLToPath(new URL("../../../../docs/migrate-password-auth.sql", import.meta.url)),
  "utf8",
);
const clients: PGlite[] = [];
async function legacyDb(): Promise<PGlite> {
  const db = new PGlite({ extensions: { pgcrypto } });
  clients.push(db);
  await db.waitReady;
  await db.exec(
    "create extension if not exists pgcrypto; create table outlets (id uuid primary key default gen_random_uuid(), name text not null, admin_pin text not null); create table staff (id uuid primary key default gen_random_uuid(), outlet_id uuid not null references outlets(id), name text not null, role text not null, pin text not null, active boolean not null default true, created_at timestamptz not null default now());",
  );
  return db;
}
afterEach(async () => Promise.all(clients.splice(0).map((db) => db.close())));

describe("password-auth migration", () => {
  it("backfills display names, removes PIN/name columns, and is idempotent", async () => {
    const db = await legacyDb();
    const outlet = await db.query<{ id: string }>(
      "insert into outlets(name,admin_pin) values ('Legacy','0000') returning id",
    );
    const id = outlet.rows[0].id;
    await db.query(
      "insert into staff(outlet_id,name,role,pin) values ($1,' Legacy User ','waiter','1234'),($1,'   ','kitchen','5678')",
      [id],
    );
    await db.exec(migration);
    expect(
      (
        await db.query(
          "select column_name from information_schema.columns where table_name='staff' and column_name in ('name','pin')",
        )
      ).rows,
    ).toEqual([]);
    expect(
      (
        await db.query(
          "select column_name from information_schema.columns where table_name='outlets' and column_name='admin_pin'",
        )
      ).rows,
    ).toEqual([]);
    expect((await db.query("select first_name from staff where role='waiter'")).rows).toEqual([
      { first_name: "Legacy User" },
    ]);
    expect((await db.query("select first_name from staff where role='kitchen'")).rows).toEqual([
      { first_name: null },
    ]);
    await db.exec(migration);
  });

  it("rolls back duplicate normalized usernames", async () => {
    const db = await legacyDb();
    const outlet = await db.query<{ id: string }>(
      "insert into outlets(name,admin_pin) values ('Legacy','0000') returning id",
    );
    await db.query("alter table staff add column username text");
    await db.query(
      "insert into staff(outlet_id,name,role,pin,username) values ($1,'A','waiter','1',' User '),($1,'B','kitchen','2','user')",
      [outlet.rows[0].id],
    );
    await expect(db.exec(migration)).rejects.toThrow(/duplicate staff usernames/i);
    await db.exec("rollback");
    expect(
      (
        await db.query(
          "select column_name from information_schema.columns where table_name='staff' and column_name='password_hash'",
        )
      ).rows,
    ).toEqual([]);
  });
});
