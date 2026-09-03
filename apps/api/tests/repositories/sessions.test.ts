import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createTestDb, type TestDb } from "../helpers/pglite.js";

// These run against a real Postgres (pglite) loaded from docs/schema.sql +
// docs/seed.sql, so the conditional updates below are proven by the database's
// own concurrency rules rather than by a fake that mimics them.

let t: TestDb;
let tableId: string;
let outletId: string;

beforeEach(async () => {
  t = await createTestDb();
  const table = await t.db
    .selectFrom("tables")
    .select(["id", "outlet_id"])
    .where("code", "=", "t1-demo")
    .executeTakeFirstOrThrow();
  tableId = table.id;
  outletId = table.outlet_id;
});

afterEach(async () => {
  await t.destroy();
});

describe("sessions.findActiveByTableId / create", () => {
  it("finds nothing before anyone sits down", async () => {
    expect(await t.repos.sessions.findActiveByTableId(tableId)).toBeNull();
  });

  it("creates an active session and finds it again", async () => {
    const created = await t.repos.sessions.create({ table_id: tableId, outlet_id: outletId });
    expect(created.status).toBe("active");
    expect(created.discount_pct).toBe(0);
    expect(created.comp_awarded).toBe(false);

    const found = await t.repos.sessions.findActiveByTableId(tableId);
    expect(found?.id).toBe(created.id);
  });

  it("refuses a second active session for the same table", async () => {
    await t.repos.sessions.create({ table_id: tableId, outlet_id: outletId });
    // uniq_active_session_per_table is what getOrCreateSession's race fallback
    // relies on — if this stopped throwing, two phones could open two tabs
    await expect(
      t.repos.sessions.create({ table_id: tableId, outlet_id: outletId }),
    ).rejects.toThrow();
  });

  it("ignores closed sessions when looking for the live one", async () => {
    const old = await t.repos.sessions.create({ table_id: tableId, outlet_id: outletId });
    await t.repos.sessions.close(old.id, new Date().toISOString());
    expect(await t.repos.sessions.findActiveByTableId(tableId)).toBeNull();

    const fresh = await t.repos.sessions.create({ table_id: tableId, outlet_id: outletId });
    expect((await t.repos.sessions.findActiveByTableId(tableId))?.id).toBe(fresh.id);
  });
});

describe("conditional claims", () => {
  it("claimDiscount wins once and returns null to every later caller", async () => {
    const s = await t.repos.sessions.create({ table_id: tableId, outlet_id: outletId });

    expect(await t.repos.sessions.claimDiscount(s.id, 10)).toEqual({ discount_pct: 10 });
    // the precondition discount_pct = 0 no longer holds
    expect(await t.repos.sessions.claimDiscount(s.id, 20)).toBeNull();
    expect((await t.repos.sessions.findById(s.id))?.discount_pct).toBe(10);
  });

  it("claimComp awards the free dish exactly once", async () => {
    const s = await t.repos.sessions.create({ table_id: tableId, outlet_id: outletId });

    expect(await t.repos.sessions.claimComp(s.id)).toMatchObject({ id: s.id });
    expect(await t.repos.sessions.claimComp(s.id)).toBeNull();
    expect((await t.repos.sessions.findById(s.id))?.comp_awarded).toBe(true);
  });

  it("claimWaiter takes an unattended table but never steals a claimed one", async () => {
    const s = await t.repos.sessions.create({ table_id: tableId, outlet_id: outletId });

    expect(await t.repos.sessions.claimWaiter(s.id, "Ravi")).toEqual({
      id: s.id,
      attendant: "Ravi",
    });
    expect(await t.repos.sessions.claimWaiter(s.id, "Meera")).toBeNull();
    expect((await t.repos.sessions.findById(s.id))?.attendant).toBe("Ravi");
  });

  it("two concurrent discount claims produce exactly one winner", async () => {
    const s = await t.repos.sessions.create({ table_id: tableId, outlet_id: outletId });
    const results = await Promise.all([
      t.repos.sessions.claimDiscount(s.id, 10),
      t.repos.sessions.claimDiscount(s.id, 20),
    ]);
    expect(results.filter(Boolean)).toHaveLength(1);
  });
});

describe("merged groups and settlement", () => {
  it("closes a whole merged group through the primary", async () => {
    const primary = await t.repos.sessions.create({ table_id: tableId, outlet_id: outletId });
    const second = await t.db
      .selectFrom("tables")
      .select("id")
      .where("code", "=", "t2-demo")
      .executeTakeFirstOrThrow();
    const joined = await t.repos.sessions.create({
      table_id: second.id,
      outlet_id: outletId,
      merged_into: primary.id,
    });

    const members = await t.repos.sessions.listActiveMergedInto(primary.id);
    expect(members).toEqual([{ id: joined.id, table_id: second.id }]);

    const closedAt = new Date().toISOString();
    await t.repos.sessions.closeMergedInto(primary.id, closedAt);
    expect((await t.repos.sessions.findById(joined.id))?.status).toBe("closed");
    expect(await t.repos.sessions.listActiveMergedInto(primary.id)).toEqual([]);
  });

  it("lists only bills settled since the day boundary", async () => {
    const s = await t.repos.sessions.create({ table_id: tableId, outlet_id: outletId });
    await t.repos.sessions.update(s.id, {
      settled_at: "2026-09-03T08:00:00.000Z",
      bill_tip: 60,
      tip_to: "Ravi",
    });

    const today = await t.repos.sessions.listSettledSince("2026-09-02T18:30:00.000Z");
    expect(today).toHaveLength(1);
    expect(Number(today[0].bill_tip)).toBe(60);
    expect(today[0].tip_to).toBe("Ravi");

    expect(await t.repos.sessions.listSettledSince("2026-09-04T18:30:00.000Z")).toEqual([]);
  });
});

describe("findOwnedByTable", () => {
  it("only matches the table the session belongs to", async () => {
    const s = await t.repos.sessions.create({ table_id: tableId, outlet_id: outletId });
    const other = await t.db
      .selectFrom("tables")
      .select("id")
      .where("code", "=", "t2-demo")
      .executeTakeFirstOrThrow();

    expect(await t.repos.sessions.findOwnedByTable(s.id, tableId)).toEqual({ id: s.id });
    expect(await t.repos.sessions.findOwnedByTable(s.id, other.id)).toBeNull();
  });
});
