import { PGlite } from "@electric-sql/pglite";
// schema.sql opens with `create extension pgcrypto` for gen_random_uuid();
// pglite ships it as a contrib extension that must be registered up front
import { pgcrypto } from "@electric-sql/pglite/contrib/pgcrypto";
import { Kysely } from "kysely";
import { pgliteDialect } from "./pgliteDialect.js";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import type { DB } from "../../src/db/types.js";
import { makeRepos, type Repos } from "../../src/repositories/index.js";

const docs = (name: string) =>
  readFileSync(fileURLToPath(new URL(`../../../../docs/${name}`, import.meta.url)), "utf8");

// docs/schema.sql is written for Supabase. Four kinds of statement in it have
// no meaning in a bare Postgres and are stripped here rather than edited out of
// the shipped schema:
//
//   1. `alter table ... enable row level security`
//   2. `create policy ...`
//   3. `grant`/`revoke` on the anon + authenticated roles
//   4. `alter publication supabase_realtime ...`
//
// The roles anon and authenticated are created first anyway, so a future grant
// that slips past the filter fails loudly instead of silently.
const SUPABASE_ONLY =
  /^\s*(alter\s+table\s+\S+\s+enable\s+row\s+level\s+security|create\s+policy|grant\s|revoke\s|alter\s+publication)/i;

function loadableStatements(sql: string): string[] {
  // strip line comments so a `--` sentence never hides a statement terminator
  const stripped = sql
    .split("\n")
    .map((line) => (line.trimStart().startsWith("--") ? "" : line))
    .join("\n");

  // split on semicolons that are not inside a $$ ... $$ block (seed.sql is one
  // large do-block)
  const statements: string[] = [];
  let buffer = "";
  let inDollar = false;
  for (let i = 0; i < stripped.length; i++) {
    if (stripped.startsWith("$$", i)) {
      inDollar = !inDollar;
      buffer += "$$";
      i++;
      continue;
    }
    const ch = stripped[i];
    if (ch === ";" && !inDollar) {
      statements.push(buffer);
      buffer = "";
      continue;
    }
    buffer += ch;
  }
  if (buffer.trim()) statements.push(buffer);

  return statements.map((s) => s.trim()).filter((s) => s.length > 0 && !SUPABASE_ONLY.test(s));
}

// Columns the live database has that docs/schema.sql has not caught up with.
// Kept beside the schema loader so the repository tests exercise the same shape
// production runs on — see the LIVE markers in src/db/types.ts.
const LIVE_COLUMNS = `
alter table outlets
  add column if not exists service_charge_pct numeric(5,2) not null default 0,
  add column if not exists gstin text,
  add column if not exists bill_seq int not null default 0;

alter table tables
  add column if not exists ui_variant text not null default 'classic',
  add column if not exists capacity int not null default 4,
  add column if not exists zone text,
  add column if not exists needs_cleaning boolean not null default false;

alter table menu_categories
  add column if not exists kind text not null default 'food';

alter table menu_items
  add column if not exists gst_pct numeric(5,2) not null default 5;

alter table sessions
  add column if not exists guests int,
  add column if not exists attendant text,
  add column if not exists merged_into uuid references sessions(id),
  add column if not exists service_waived boolean not null default false,
  add column if not exists bill_no text,
  add column if not exists bill_gross numeric(10,2),
  add column if not exists bill_discount numeric(10,2),
  add column if not exists bill_gst numeric(10,2),
  add column if not exists bill_service numeric(10,2),
  add column if not exists bill_tip numeric(10,2),
  add column if not exists bill_net numeric(10,2),
  add column if not exists tip_to text,
  add column if not exists settled_at timestamptz;

alter table orders
  add column if not exists lang text;

alter table order_items
  add column if not exists gst_pct numeric(5,2) not null default 5;

alter table waiter_calls
  add column if not exists acked_at timestamptz,
  add column if not exists acked_by text;

-- the live check constraints allow the statuses the staff screens actually set
alter table orders drop constraint if exists orders_status_check;
alter table orders add constraint orders_status_check
  check (status in ('placed','preparing','ready','served','cancelled'));

alter table order_items drop constraint if exists order_items_status_check;
alter table order_items add constraint order_items_status_check
  check (status in ('queued','preparing','ready','served','cancelled'));

alter table order_items
  add column if not exists cancelled_at timestamptz,
  add column if not exists cancelled_by text;

alter table orders drop constraint if exists orders_placed_via_check;
alter table orders add constraint orders_placed_via_check
  check (placed_via in ('ui','anna','waiter'));

alter table payments drop constraint if exists payments_method_check;
`;

export type TestDb = {
  db: Kysely<DB>;
  repos: Repos;
  raw: PGlite;
  destroy: () => Promise<void>;
};

// A real Postgres in-process. Loads the shipped schema, the i18n migration, the
// live columns above, and the demo seed.
export async function createTestDb(opts?: { seed?: boolean }): Promise<TestDb> {
  const client = new PGlite({ extensions: { pgcrypto } });
  await client.waitReady;

  // schema.sql grants to these; creating them keeps a stray grant honest
  await client.exec(`
    do $$ begin
      if not exists (select 1 from pg_roles where rolname = 'anon') then create role anon; end if;
      if not exists (select 1 from pg_roles where rolname = 'authenticated') then create role authenticated; end if;
    end $$;
  `);

  for (const statement of loadableStatements(docs("schema.sql"))) {
    await client.exec(statement);
  }
  // docs/migrate-i18n-columns.sql is deliberately NOT loaded. Its UPDATEs read
  // the old `i18n` jsonb column, which a fresh docs/schema.sql never creates —
  // the file only makes sense on a database that predates the migration. Its
  // add-column half is already in schema.sql, so on a fresh install the whole
  // migration is a no-op and running it just fails on the missing column.
  await client.exec(LIVE_COLUMNS);
  if (opts?.seed !== false) {
    for (const statement of loadableStatements(docs("seed.sql"))) {
      await client.exec(statement);
    }
  }

  const db = new Kysely<DB>({ dialect: pgliteDialect(client) });

  return {
    db,
    repos: makeRepos(db),
    raw: client,
    // db.destroy() closes the underlying PGlite client too, so closing it
    // again throws "PGlite is closed"
    destroy: async () => {
      await db.destroy();
    },
  };
}
