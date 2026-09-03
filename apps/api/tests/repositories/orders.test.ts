import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createTestDb, type TestDb } from "../helpers/pglite.js";

let t: TestDb;
let tableId: string;
let outletId: string;
let sessionId: string;
let menuItems: { id: string; name: string; price_inr: string; gst_pct: number }[];

beforeEach(async () => {
  t = await createTestDb();
  const table = await t.db
    .selectFrom("tables")
    .select(["id", "outlet_id"])
    .where("code", "=", "t1-demo")
    .executeTakeFirstOrThrow();
  tableId = table.id;
  outletId = table.outlet_id;
  const session = await t.repos.sessions.create({ table_id: tableId, outlet_id: outletId });
  sessionId = session.id;
  menuItems = await t.repos.menuItems.findPricesByIds(
    (await t.db.selectFrom("menu_items").select("id").limit(3).execute()).map((r) => r.id),
  );
});

afterEach(async () => {
  await t.destroy();
});

// Place a round the way the order route does: create the order, then its items.
async function placeRound(status = "placed") {
  const order = await t.repos.orders.create({
    session_id: sessionId,
    outlet_id: outletId,
    total_inr: 520,
    placed_via: "ui",
    placed_by: "Asha",
    lang: "hi",
    status,
  });
  await t.repos.orderItems.createMany(
    menuItems.slice(0, 2).map((m) => ({
      order_id: order.id,
      menu_item_id: m.id,
      name: m.name,
      unit_price: m.price_inr,
      gst_pct: m.gst_pct,
      qty: 2,
      notes: null,
    })),
  );
  return order;
}

describe("orders.create + listBySessionWithItems", () => {
  it("stores a round and reads it back with its dishes", async () => {
    const order = await placeRound();

    const rounds = await t.repos.orders.listBySessionWithItems(sessionId);
    expect(rounds).toHaveLength(1);
    expect(rounds[0]).toMatchObject({
      id: order.id,
      status: "placed",
      placed_by: "Asha",
      placed_via: "ui",
    });
    expect(rounds[0].items).toHaveLength(2);
    expect(rounds[0].items[0]).toMatchObject({ qty: 2, status: "queued" });
    expect(rounds[0].items.map((i) => i.name).sort()).toEqual(
      menuItems
        .slice(0, 2)
        .map((m) => m.name)
        .sort(),
    );
  });

  it("returns rounds oldest first", async () => {
    const first = await placeRound();
    await new Promise((r) => setTimeout(r, 5));
    const second = await placeRound();
    const rounds = await t.repos.orders.listBySessionWithItems(sessionId);
    expect(rounds.map((r) => r.id)).toEqual([first.id, second.id]);
  });

  it("gives a round with no dishes an empty array, not null", async () => {
    await t.repos.orders.create({ session_id: sessionId, outlet_id: outletId, total_inr: 0 });
    const rounds = await t.repos.orders.listBySessionWithItems(sessionId);
    expect(rounds[0].items).toEqual([]);
  });

  it("existsForSession gates the comp prize", async () => {
    expect(await t.repos.orders.existsForSession(sessionId)).toBe(false);
    await placeRound();
    expect(await t.repos.orders.existsForSession(sessionId)).toBe(true);
  });
});

describe("orders.listForKitchen", () => {
  it("carries the table label down through the session", async () => {
    await placeRound();
    const tickets = await t.repos.orders.listForKitchen();
    expect(tickets).toHaveLength(1);
    expect(tickets[0].session?.table?.label).toBe("Table 1");
    expect(tickets[0].items).toHaveLength(2);
    expect(tickets[0].lang).toBe("hi");
  });

  it("hides cancelled tickets from the rail", async () => {
    const order = await placeRound();
    await t.repos.orders.setStatus(order.id, "cancelled");
    expect(await t.repos.orders.listForKitchen()).toEqual([]);
  });
});

describe("order item status", () => {
  it("advances one dish and reads its siblings back for the derived status", async () => {
    const order = await placeRound();
    const items = await t.db
      .selectFrom("order_items")
      .select("id")
      .where("order_id", "=", order.id)
      .execute();

    await t.repos.orderItems.setStatus(items[0].id, "ready");
    const statuses = await t.repos.orderItems.listStatusesByOrder(order.id);
    expect(statuses.map((s) => s.status).sort()).toEqual(["queued", "ready"]);

    expect(await t.repos.orderItems.findOrderId(items[0].id)).toEqual({ order_id: order.id });
  });

  it("setStatusByOrderWhere only moves the dishes nobody has touched", async () => {
    const order = await placeRound();
    const items = await t.db
      .selectFrom("order_items")
      .select("id")
      .where("order_id", "=", order.id)
      .orderBy("id")
      .execute();
    await t.repos.orderItems.setStatus(items[0].id, "ready");

    await t.repos.orderItems.setStatusByOrderWhere(order.id, "queued", "preparing");
    const after = await t.db
      .selectFrom("order_items")
      .select(["id", "status"])
      .where("order_id", "=", order.id)
      .orderBy("id")
      .execute();
    // the ready dish is left alone; only the queued one starts cooking
    expect(after.map((r) => r.status)).toEqual(["ready", "preparing"]);
  });

  it("setStatusByOrder drags every dish along with the ticket", async () => {
    const order = await placeRound();
    await t.repos.orderItems.setStatusByOrder(order.id, "served");
    const statuses = await t.repos.orderItems.listStatusesByOrder(order.id);
    expect(statuses.every((s) => s.status === "served")).toBe(true);
  });
});

describe("orders.listForAdmin", () => {
  it("joins the session, its table and its payments", async () => {
    await placeRound();
    await t.repos.payments.create({
      session_id: sessionId,
      amount_inr: 100,
      status: "confirmed",
      method: "cash",
    });

    const rows = await t.repos.orders.listForAdmin(null);
    expect(rows).toHaveLength(1);
    expect(rows[0].session?.table?.label).toBe("Table 1");
    expect(rows[0].session?.payments).toHaveLength(1);
    expect(Number(rows[0].session?.payments[0].amount_inr)).toBe(100);
    expect(rows[0].items).toHaveLength(2);
  });

  it("filters by the since boundary", async () => {
    await placeRound();
    expect(await t.repos.orders.listForAdmin("2020-01-01T00:00:00.000Z")).toHaveLength(1);
    expect(await t.repos.orders.listForAdmin("2999-01-01T00:00:00.000Z")).toHaveLength(0);
  });
});

describe("sessions.findForBilling", () => {
  it("returns the table, every round with its priced items, and the payments", async () => {
    await placeRound("served");
    await t.repos.payments.create({
      session_id: sessionId,
      amount_inr: 200,
      status: "confirmed",
      method: "upi_intent",
    });

    const row = await t.repos.sessions.findForBilling(sessionId);
    expect(row?.table?.label).toBe("Table 1");
    expect(row?.orders).toHaveLength(1);
    expect(row?.orders[0].items).toHaveLength(2);
    // the join carries the frozen unit price and GST rate the bill needs
    expect(Number(row?.orders[0].items[0].unit_price)).toBeGreaterThan(0);
    expect(Number(row?.orders[0].items[0].gst_pct)).toBe(5);
    expect(row?.payments).toHaveLength(1);
    expect(row?.discount_pct).toBe(0);
    expect(row?.service_waived).toBe(false);
  });

  it("is null for a session that does not exist", async () => {
    expect(
      await t.repos.sessions.findForBilling("00000000-0000-0000-0000-000000000000"),
    ).toBeNull();
  });
});
