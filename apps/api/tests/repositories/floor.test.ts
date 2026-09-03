import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { computeBill } from "../../src/services/billing.js";
import { hashPassword } from "../../src/lib/password.js";
import { generateBill, recordPayment } from "../../src/services/settle.js";
import { placeOrder } from "../../src/services/order.js";
import { mergeSession } from "../../src/services/floor.js";
import { createTestDb, type TestDb } from "../helpers/pglite.js";

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

describe("tables", () => {
  it("finds a table by its QR code", async () => {
    const row = await t.repos.tables.findByCode("t1-demo");
    expect(row).toMatchObject({ id: tableId, outlet_id: outletId, ui_variant: "classic" });
    expect(await t.repos.tables.findByCode("nope")).toBeNull();
  });

  it("flags several tables for cleaning at once", async () => {
    const all = await t.repos.tables.listAll(outletId);
    const ids = all.slice(0, 2).map((r) => r.id);
    await t.repos.tables.setNeedsCleaning(ids, true, outletId);

    const after = await t.repos.tables.listAll(outletId);
    expect(
      after
        .filter((r) => r.needs_cleaning)
        .map((r) => r.id)
        .sort(),
    ).toEqual([...ids].sort());
  });

  it("clearCleaningIfNeeded is a no-op on an already clean table", async () => {
    await t.repos.tables.setNeedsCleaning([tableId], true, outletId);
    await t.repos.tables.clearCleaningIfNeeded(tableId, outletId);
    expect((await t.repos.tables.findById(tableId, outletId))?.needs_cleaning).toBe(false);
    // second call changes nothing and must not throw
    await t.repos.tables.clearCleaningIfNeeded(tableId, outletId);
    expect((await t.repos.tables.findById(tableId, outletId))?.needs_cleaning).toBe(false);
  });

  it("adds tables in a batch and lists them for the admin screen", async () => {
    await t.repos.tables.createMany([
      { outlet_id: outletId, label: "Table 90", code: "table-90", capacity: 6 },
      { outlet_id: outletId, label: "Table 91", code: "table-91", capacity: 2 },
    ]);
    const rows = await t.repos.tables.listForAdmin(outletId);
    expect(rows.find((r) => r.code === "table-90")?.capacity).toBe(6);
    expect(rows.map((r) => r.label)).toContain("Table 91");
  });
});

describe("waiter calls", () => {
  it("rings once and stays a single open call until it is acknowledged", async () => {
    expect(await t.repos.waiterCalls.findOpenByTable(tableId, outletId)).toBeNull();

    await t.repos.waiterCalls.create({ table_id: tableId, outlet_id: outletId });
    const open = await t.repos.waiterCalls.findOpenByTable(tableId, outletId);
    expect(open).not.toBeNull();
    expect(await t.repos.waiterCalls.listOpen(outletId)).toHaveLength(1);

    await t.repos.waiterCalls.ack(open!.id, new Date().toISOString(), "Ravi", outletId);
    expect(await t.repos.waiterCalls.findOpenByTable(tableId, outletId)).toBeNull();
    expect(await t.repos.waiterCalls.listOpen(outletId)).toEqual([]);
  });
});

describe("staff", () => {
  it("lists only active accounts for login and enforces one username per outlet", async () => {
    for (const staff of await t.repos.staff.listAll()) {
      await t.repos.staff.remove(staff.id);
    }

    await t.repos.staff.create({
      outlet_id: outletId,
      username: "ravi",
      first_name: "Ravi",
      last_name: null,
      role: "waiter",
      password_hash: await hashPassword("ravi-test-password"),
    });
    await t.repos.staff.create({
      outlet_id: outletId,
      username: "devi",
      first_name: "Devi",
      last_name: null,
      role: "kitchen",
      password_hash: await hashPassword("devi-test-password"),
    });

    const active = await t.repos.staff.findActiveByUsername(outletId, "ravi");
    expect(active?.first_name).toBe("Ravi");
    const allActive = await t.db
      .selectFrom("staff")
      .select("username")
      .where("active", "=", true)
      .execute();
    expect(allActive.map((s) => s.username).sort()).toEqual(["devi", "ravi"]);

    // idx_staff_username_ci is unique per outlet — the admin screen turns this into 409
    await expect(
      t.repos.staff.create({
        outlet_id: outletId,
        username: "RAVI",
        first_name: "Ravi Again",
        last_name: null,
        role: "waiter",
        password_hash: await hashPassword("clash-test-password"),
      }),
    ).rejects.toThrow();

    const all = await t.repos.staff.listAll();
    await t.repos.staff.setActive(all[0].id, false);
    const remainingActive = await t.db
      .selectFrom("staff")
      .select("username")
      .where("active", "=", true)
      .execute();
    expect(remainingActive).toHaveLength(1);

    await t.repos.staff.remove(all[0].id);
    expect(await t.repos.staff.listAll()).toHaveLength(1);
  });
});

describe("the settle flow end to end", () => {
  it("raises a bill, takes the money, closes the tab and flags the table", async () => {
    const session = await t.repos.sessions.create({ table_id: tableId, outlet_id: outletId });
    const item = await t.db
      .selectFrom("menu_items")
      .select(["id", "name", "price_inr", "gst_pct"])
      .where("name", "=", "Paneer Tikka")
      .executeTakeFirstOrThrow();

    const order = await t.repos.orders.create({
      session_id: session.id,
      outlet_id: outletId,
      total_inr: item.price_inr,
      status: "served",
    });
    await t.repos.orderItems.createMany([
      {
        order_id: order.id,
        menu_item_id: item.id,
        name: item.name,
        unit_price: item.price_inr,
        gst_pct: item.gst_pct,
        qty: 1,
        status: "served",
      },
    ]);

    const preview = await computeBill(t.repos, session.id, undefined, outletId);
    expect(preview.gross).toBe(280);
    expect(preview.gst).toBe(14); // 5% of 280
    expect(preview.paid).toBe(0);

    const raised = await generateBill(t.repos, session.id, outletId);
    expect(raised.billNo).toMatch(/^NAR-\d{8}-0001$/);
    expect(raised.net).toBe(294);
    // the invoice counter really advanced on the outlet row
    expect((await t.repos.outlets.findBillSeq(outletId))?.bill_seq).toBe(1);

    const paid = await recordPayment(
      t.repos,
      { sessionId: session.id, method: "cash" },
      outletId,
      "Ravi",
    );
    expect(paid).toMatchObject({ ok: true, due: 0, closed: true });

    expect((await t.repos.sessions.findById(session.id, outletId))?.status).toBe("closed");
    expect((await t.repos.tables.findById(tableId, outletId))?.needs_cleaning).toBe(true);
    expect(await t.repos.sessions.findActiveByTableId(tableId, outletId)).toBeNull();

    const payments = await t.repos.payments.listBySession(session.id);
    expect(Number(payments[0].amount_inr)).toBe(294);
    expect(payments[0].status).toBe("confirmed");
  });

  it("serializes competing bill requests without consuming two invoice numbers", async () => {
    const session = await t.repos.sessions.create({ table_id: tableId, outlet_id: outletId });
    const results = await Promise.allSettled([
      generateBill(t.repos, session.id, outletId),
      generateBill(t.repos, session.id, outletId),
    ]);
    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    expect(results.filter((r) => r.status === "rejected")).toHaveLength(1);
    expect((await t.repos.outlets.findBillSeq(outletId))?.bill_seq).toBe(1);
  });

  it("rejects an order once the bill is frozen", async () => {
    const session = await t.repos.sessions.create({ table_id: tableId, outlet_id: outletId });
    const item = await t.db
      .selectFrom("menu_items")
      .select(["id"])
      .where("name", "=", "Paneer Tikka")
      .executeTakeFirstOrThrow();
    await generateBill(t.repos, session.id, outletId);
    await expect(
      placeOrder(t.repos, {
        sessionId: session.id,
        outletId,
        cart: [{ itemId: item.id, qty: 1 }],
      }),
    ).rejects.toMatchObject({ statusCode: 409 });
  });

  it("freezes one invoice for a merged group and rejects child writes after it", async () => {
    const otherTable = await t.repos.tables.findByCode("t2-demo");
    expect(otherTable).not.toBeNull();
    const primary = await t.repos.sessions.create({ table_id: tableId, outlet_id: outletId });
    const child = await t.repos.sessions.create({
      table_id: otherTable!.id,
      outlet_id: outletId,
    });
    const item = await t.db
      .selectFrom("menu_items")
      .select(["id"])
      .where("name", "=", "Paneer Tikka")
      .executeTakeFirstOrThrow();

    for (const session of [primary, child]) {
      await placeOrder(t.repos, {
        sessionId: session.id,
        outletId,
        cart: [{ itemId: item.id, qty: 1 }],
      });
    }
    await mergeSession(t.repos, child.id, primary.id, outletId);

    const raised = await generateBill(t.repos, primary.id, outletId);
    expect(raised.net).toBe(588); // 2 x (280 + 5% GST; seeded service is 0%)
    expect(raised.billNo).toMatch(/-0001$/);

    await expect(
      placeOrder(t.repos, {
        sessionId: child.id,
        outletId,
        cart: [{ itemId: item.id, qty: 1 }],
      }),
    ).rejects.toMatchObject({ statusCode: 409 });

    const paid = await recordPayment(t.repos, { sessionId: child.id, method: "cash" }, outletId);
    expect(paid).toMatchObject({ ok: true, closed: true, due: 0 });
  });
});
