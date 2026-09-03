import type { Insertable, Kysely, Updateable } from "kysely";
import type { DB, StaffTable } from "../db/types.js";

const columns = [
  "id",
  "outlet_id",
  "username",
  "first_name",
  "last_name",
  "role",
  "password_hash",
  "active",
  "created_at",
] as const;

export function makeStaffRepo(db: Kysely<DB>) {
  return {
    findById: async (id: string) =>
      (await db.selectFrom("staff").select(columns).where("id", "=", id).executeTakeFirst()) ??
      null,
    findActiveById: async (id: string) =>
      (await db
        .selectFrom("staff")
        .select(columns)
        .where("id", "=", id)
        .where("active", "=", true)
        .executeTakeFirst()) ?? null,
    findByUsername: async (outletId: string, username: string) =>
      (await db
        .selectFrom("staff")
        .select(columns)
        .where("outlet_id", "=", outletId)
        .where("username", "=", username)
        .executeTakeFirst()) ?? null,
    findActiveByUsername: async (outletId: string, username: string) =>
      (await db
        .selectFrom("staff")
        .select(columns)
        .where("outlet_id", "=", outletId)
        .where("username", "=", username)
        .where("active", "=", true)
        .executeTakeFirst()) ?? null,
    listByOutlet: async (outletId: string) =>
      db
        .selectFrom("staff")
        .select(columns)
        .where("outlet_id", "=", outletId)
        .orderBy("created_at")
        .execute(),
    countActiveAdmins: async (outletId: string) =>
      Number(
        (
          await db
            .selectFrom("staff")
            .select(({ fn }) => fn.countAll<number>().as("count"))
            .where("outlet_id", "=", outletId)
            .where("role", "=", "admin")
            .where("active", "=", true)
            .executeTakeFirst()
        )?.count ?? 0,
      ),
    hasActiveAdminWithPassword: async (outletId: string) =>
      Boolean(
        await db
          .selectFrom("staff")
          .select("id")
          .where("outlet_id", "=", outletId)
          .where("role", "=", "admin")
          .where("active", "=", true)
          .where("password_hash", "is not", null)
          .executeTakeFirst(),
      ),
    create: async (row: Insertable<StaffTable>) =>
      db.insertInto("staff").values(row).returning(columns).executeTakeFirstOrThrow(),
    update: async (id: string, patch: Updateable<StaffTable>) =>
      (await db
        .updateTable("staff")
        .set(patch)
        .where("id", "=", id)
        .returning(columns)
        .executeTakeFirst()) ?? null,
    updateScoped: async (id: string, outletId: string, patch: Updateable<StaffTable>) =>
      db.transaction().execute(async (tx) => {
        const outlet = await tx
          .selectFrom("outlets")
          .select("id")
          .where("id", "=", outletId)
          .forUpdate()
          .executeTakeFirst();
        if (!outlet) return null;
        const target = await tx
          .selectFrom("staff")
          .select(["id", "role", "active"])
          .where("id", "=", id)
          .where("outlet_id", "=", outletId)
          .forUpdate()
          .executeTakeFirst();
        if (!target) return null;
        const demotesFinalAdmin =
          target.role === "admin" &&
          target.active &&
          (patch.active === false || (patch.role !== undefined && patch.role !== "admin"));
        if (demotesFinalAdmin) {
          const count = Number(
            (
              await tx
                .selectFrom("staff")
                .select(({ fn }) => fn.countAll<number>().as("count"))
                .where("outlet_id", "=", outletId)
                .where("role", "=", "admin")
                .where("active", "=", true)
                .executeTakeFirst()
            )?.count ?? 0,
          );
          if (count <= 1) throw new Error("cannot remove final active admin");
        }
        return (
          (await tx
            .updateTable("staff")
            .set(patch)
            .where("id", "=", id)
            .where("outlet_id", "=", outletId)
            .returning(columns)
            .executeTakeFirst()) ?? null
        );
      }),
    removeScoped: async (id: string, outletId: string) =>
      db.transaction().execute(async (tx) => {
        const outlet = await tx
          .selectFrom("outlets")
          .select("id")
          .where("id", "=", outletId)
          .forUpdate()
          .executeTakeFirst();
        if (!outlet) return false;
        const target = await tx
          .selectFrom("staff")
          .select(["id", "role", "active"])
          .where("id", "=", id)
          .where("outlet_id", "=", outletId)
          .forUpdate()
          .executeTakeFirst();
        if (!target) return false;
        if (target.role === "admin" && target.active) {
          const count = Number(
            (
              await tx
                .selectFrom("staff")
                .select(({ fn }) => fn.countAll<number>().as("count"))
                .where("outlet_id", "=", outletId)
                .where("role", "=", "admin")
                .where("active", "=", true)
                .executeTakeFirst()
            )?.count ?? 0,
          );
          if (count <= 1) throw new Error("cannot remove final active admin");
        }
        await tx
          .deleteFrom("staff")
          .where("id", "=", id)
          .where("outlet_id", "=", outletId)
          .execute();
        return true;
      }),
    remove: async (id: string) => {
      await db.deleteFrom("staff").where("id", "=", id).execute();
    },
    listAll: async () => db.selectFrom("staff").select(columns).orderBy("created_at").execute(),
    setActive: async (id: string, active: boolean) => {
      await db.updateTable("staff").set({ active }).where("id", "=", id).execute();
    },
  };
}
