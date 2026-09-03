import type { PGlite } from "@electric-sql/pglite";
import {
  CompiledQuery,
  PostgresAdapter,
  PostgresIntrospector,
  PostgresQueryCompiler,
  type DatabaseConnection,
  type Dialect,
  type Driver,
  type QueryResult,
} from "kysely";

// A ~40-line Kysely dialect over PGlite, written here rather than pulled from
// npm: the published dialects either drag kysely-codegen in (which hoists a
// second, older kysely into the tree and breaks typecheck) or cap their peer
// range below pglite 0.5. PGlite already speaks the wire protocol, so the
// adapter, introspector and compiler are just the stock Postgres ones.

class PGliteConnection implements DatabaseConnection {
  constructor(private readonly client: PGlite) {}

  async executeQuery<R>(compiled: CompiledQuery): Promise<QueryResult<R>> {
    const result = await this.client.query<R>(compiled.sql, [...compiled.parameters]);
    return {
      rows: result.rows,
      numAffectedRows: BigInt(result.affectedRows ?? 0),
    };
  }

  async *streamQuery<R>(): AsyncIterableIterator<QueryResult<R>> {
    throw new Error("streaming is not supported by the pglite test dialect");
  }
}

class PGliteDriver implements Driver {
  private readonly connection: PGliteConnection;

  constructor(private readonly client: PGlite) {
    this.connection = new PGliteConnection(client);
  }

  async init(): Promise<void> {
    await this.client.waitReady;
  }

  // PGlite is single-connection by nature, so every acquire hands back the same
  // one and release is a no-op
  async acquireConnection(): Promise<DatabaseConnection> {
    return this.connection;
  }

  async beginTransaction(conn: DatabaseConnection): Promise<void> {
    await conn.executeQuery(CompiledQuery.raw("begin"));
  }

  async commitTransaction(conn: DatabaseConnection): Promise<void> {
    await conn.executeQuery(CompiledQuery.raw("commit"));
  }

  async rollbackTransaction(conn: DatabaseConnection): Promise<void> {
    await conn.executeQuery(CompiledQuery.raw("rollback"));
  }

  async releaseConnection(): Promise<void> {}

  async destroy(): Promise<void> {
    await this.client.close();
  }
}

export function pgliteDialect(client: PGlite): Dialect {
  return {
    createAdapter: () => new PostgresAdapter(),
    createDriver: () => new PGliteDriver(client),
    createIntrospector: (db) => new PostgresIntrospector(db),
    createQueryCompiler: () => new PostgresQueryCompiler(),
  };
}
