import { afterEach, describe, expect, it } from "vitest";
import { createTestDb } from "../helpers/pglite.js";
import { computeBill } from "../../src/services/billing.js";

describe("main product parity repositories", () => {
  const dbs: Awaited<ReturnType<typeof createTestDb>>[] = [];
  afterEach(async () => Promise.all(dbs.splice(0).map((db) => db.destroy())));

  it("keeps availability and audit reads outlet-scoped", async () => {
    const t = await createTestDb({ seed: false });
    dbs.push(t);
    const a = await t.raw.query<{ id: string }>(
      "insert into outlets(name,slug,tables_enabled) values ('A','a',true) returning id",
    );
    const b = await t.raw.query<{ id: string }>(
      "insert into outlets(name,slug,tables_enabled) values ('B','b',true) returning id",
    );
    await t.raw.query(
      "insert into menu_categories(outlet_id,name) values ($1,'Food'),($2,'Food')",
      [a.rows[0].id, b.rows[0].id],
    );
    const cats = await t.raw.query<{ id: string; outlet_id: string }>(
      "select id,outlet_id from menu_categories order by outlet_id",
    );
    await t.raw.query(
      "insert into menu_items(outlet_id,category_id,name,price_inr) values ($1,$2,'A dish',10),($3,$4,'B dish',20)",
      [a.rows[0].id, cats.rows[0].id, b.rows[0].id, cats.rows[1].id],
    );
    await t.repos.audit.create({
      outlet_id: a.rows[0].id,
      staff_id: null,
      role: "admin",
      actor_name: "A",
      action: "dish_sold_out",
      entity_type: "menu_item",
      entity_id: null,
      details: { name: "A dish" },
    });
    expect(await t.repos.menuItems.listAvailability(a.rows[0].id)).toHaveLength(1);
    expect(await t.repos.menuItems.listAvailability(b.rows[0].id)).toHaveLength(1);
    expect(await t.repos.audit.listRecent(b.rows[0].id)).toEqual([]);
  });

  it("loads a KOT only through the order's outlet", async () => {
    const t = await createTestDb({ seed: false });
    dbs.push(t);
    const outlet = (
      await t.raw.query<{ id: string }>(
        "insert into outlets(name,slug,tables_enabled) values ('KOT','kot',true) returning id",
      )
    ).rows[0];
    const table = (
      await t.raw.query<{ id: string }>(
        "insert into tables(outlet_id,label,code) values ($1,'Table 1','kot-1') returning id",
        [outlet.id],
      )
    ).rows[0];
    const session = (
      await t.raw.query<{ id: string }>(
        "insert into sessions(outlet_id,table_id) values ($1,$2) returning id",
        [outlet.id, table.id],
      )
    ).rows[0];
    const orderRow = (
      await t.raw.query<{ id: string }>(
        "insert into orders(outlet_id,session_id,total_inr) values ($1,$2,10) returning id",
        [outlet.id, session.id],
      )
    ).rows[0];
    const category = (
      await t.raw.query<{ id: string }>(
        "insert into menu_categories(outlet_id,name) values ($1,'Food') returning id",
        [outlet.id],
      )
    ).rows[0];
    const item = (
      await t.raw.query<{ id: string }>(
        "insert into menu_items(outlet_id,category_id,name,price_inr) values ($1,$2,'Dish',10) returning id",
        [outlet.id, category.id],
      )
    ).rows[0];
    await t.raw.query(
      "insert into order_items(order_id,menu_item_id,name,unit_price,qty) values ($1,$2,'Dish',10,1)",
      [orderRow.id, item.id],
    );
    const order = (
      await t.raw.query<{ id: string; outlet_id: string }>(
        "select id,outlet_id from orders limit 1",
      )
    ).rows[0];
    expect(await t.repos.orders.findForKot(order.id, order.outlet_id)).toMatchObject({
      id: order.id,
      items: expect.any(Array),
    });
    expect(
      await t.repos.orders.findForKot(order.id, "00000000-0000-0000-0000-000000000000"),
    ).toBeNull();

    const takeawaySession = (
      await t.raw.query<{ id: string }>(
        "insert into sessions(outlet_id,service_type) values ($1,'takeaway') returning id",
        [order.outlet_id],
      )
    ).rows[0];
    const takeawayOrder = (
      await t.raw.query<{ id: string }>(
        "insert into orders(outlet_id,session_id,total_inr) values ($1,$2,0) returning id",
        [order.outlet_id, takeawaySession.id],
      )
    ).rows[0];
    const menu = (
      await t.raw.query<{ id: string }>(
        "insert into menu_items(outlet_id,category_id,name,price_inr) select $1,id,'Takeaway dish',10 from menu_categories where outlet_id=$1 limit 1 returning id",
        [order.outlet_id],
      )
    ).rows[0];
    await t.raw.query(
      "insert into order_items(order_id,menu_item_id,name,unit_price,qty) values ($1,$2,'Takeaway dish',10,1)",
      [takeawayOrder.id, menu.id],
    );
    expect(await t.repos.orders.findForKot(takeawayOrder.id, order.outlet_id)).toMatchObject({
      session: { table: null },
    });
  });

  it("excludes a cancelled item from a partially-live real bill", async () => {
    const t = await createTestDb({ seed: false });
    dbs.push(t);
    const outlet = (
      await t.raw.query<{ id: string }>(
        "insert into outlets(name,slug,tables_enabled,service_charge_pct) values ('Bill','bill',true,0) returning id",
      )
    ).rows[0];
    const table = (
      await t.raw.query<{ id: string }>(
        "insert into tables(outlet_id,label,code) values ($1,'Table 1','bill-1') returning id",
        [outlet.id],
      )
    ).rows[0];
    const session = (
      await t.raw.query<{ id: string }>(
        "insert into sessions(outlet_id,table_id) values ($1,$2) returning id",
        [outlet.id, table.id],
      )
    ).rows[0];
    const category = (
      await t.raw.query<{ id: string }>(
        "insert into menu_categories(outlet_id,name) values ($1,'Food') returning id",
        [outlet.id],
      )
    ).rows[0];
    const menu = await t.raw.query<{ id: string }>(
      "insert into menu_items(outlet_id,category_id,name,price_inr) values ($1,$2,'Dish',10),($1,$2,'Cancelled Dish',90) returning id",
      [outlet.id, category.id],
    );
    const order = (
      await t.raw.query<{ id: string }>(
        "insert into orders(outlet_id,session_id,total_inr,status) values ($1,$2,100,'served') returning id",
        [outlet.id, session.id],
      )
    ).rows[0];
    await t.raw.query(
      "insert into order_items(order_id,menu_item_id,name,unit_price,qty,status) values ($1,$2,'Dish',10,1,'served'),($1,$3,'Cancelled Dish',90,1,'cancelled')",
      [order.id, menu.rows[0].id, menu.rows[1].id],
    );
    const bill = await computeBill(t.repos, session.id, undefined, outlet.id);
    expect(bill.gross).toBe(10);
  });
});
