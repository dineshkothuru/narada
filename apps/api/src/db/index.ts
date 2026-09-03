import { Kysely, PostgresDialect } from "kysely";
import { Pool } from "pg";
import { env } from "../env.js";
import type { DB } from "./types.js";

export const db = new Kysely<DB>({
  dialect: new PostgresDialect({
    pool: new Pool({ connectionString: env.DATABASE_URL, max: 5 }),
  }),
});
