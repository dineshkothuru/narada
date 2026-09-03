import type { Insertable, Kysely, Updateable } from "kysely";
import type { CustomersTable, DB } from "../db/types.js";

const columns = [
  "id",
  "phone",
  "first_name",
  "last_name",
  "password_hash",
  "active",
  "created_at",
] as const;

export function makeCustomersRepo(db: Kysely<DB>) {
  return {
    findById: async (id: string) =>
      (await db.selectFrom("customers").select(columns).where("id", "=", id).executeTakeFirst()) ??
      null,
    findActiveById: async (id: string) =>
      (await db
        .selectFrom("customers")
        .select(columns)
        .where("id", "=", id)
        .where("active", "=", true)
        .executeTakeFirst()) ?? null,
    findByPhone: async (phone: string) =>
      (await db
        .selectFrom("customers")
        .select(columns)
        .where("phone", "=", phone)
        .executeTakeFirst()) ?? null,
    findActiveByPhone: async (phone: string) =>
      (await db
        .selectFrom("customers")
        .select(columns)
        .where("phone", "=", phone)
        .where("active", "=", true)
        .executeTakeFirst()) ?? null,
    create: async (row: Insertable<CustomersTable>) =>
      db.insertInto("customers").values(row).returning(columns).executeTakeFirstOrThrow(),
    update: async (id: string, patch: Updateable<CustomersTable>) =>
      (await db
        .updateTable("customers")
        .set(patch)
        .where("id", "=", id)
        .returning(columns)
        .executeTakeFirst()) ?? null,
  };
}
