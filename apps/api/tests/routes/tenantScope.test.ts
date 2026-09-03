import { describe, expect, it } from "vitest";
import { buildApp } from "../../src/app.js";
import { seed, type FakeDb } from "../helpers/fakeRepos.js";
import { staffHeader } from "../helpers/staffCookie.js";

function addSecondOutlet(data: FakeDb) {
  const source = data.outlets[0];
  if (!source) throw new Error("seed outlet missing");
  const outlet = { ...structuredClone(source), id: "outlet-two" };
  data.outlets.push(outlet);
  for (const staff of data.staff.filter((row) => row.outlet_id === source.id)) {
    data.staff.push({ ...structuredClone(staff), id: `${staff.id}-two`, outlet_id: outlet.id });
  }

  const tableId = "table-two";
  const categoryId = "category-two";
  const itemId = "item-two";
  const sessionId = "session-two";
  const orderId = "order-two";
  data.tables.push({
    id: tableId,
    outlet_id: outlet.id,
    label: "Outlet Two Table",
    code: "outlet-two-table",
    capacity: 4,
    ui_variant: "classic",
    zone: null,
    needs_cleaning: false,
    created_at: new Date().toISOString(),
  });
  data.menu_categories.push({
    id: categoryId,
    outlet_id: outlet.id,
    name: "Outlet Two Category",
    emoji: "🍽️",
    sort_order: 1,
    kind: "food",
  });
  data.menu_items.push({
    id: itemId,
    outlet_id: outlet.id,
    category_id: categoryId,
    name: "Outlet Two Dish",
    price_inr: 99,
    gst_pct: 5,
    is_veg: true,
    spice_level: 0,
    allergens: [],
    tags: [],
    is_available: true,
    sort_order: 1,
  });
  data.sessions.push({
    id: sessionId,
    outlet_id: outlet.id,
    table_id: tableId,
    status: "active",
    created_at: new Date().toISOString(),
    closed_at: null,
    discount_pct: 0,
    comp_awarded: false,
    guests: 2,
    attendant: null,
    merged_into: null,
    service_waived: false,
    bill_no: null,
    bill_tip: null,
    tip_to: null,
    settled_at: null,
  });
  data.orders.push({
    id: orderId,
    outlet_id: outlet.id,
    session_id: sessionId,
    status: "placed",
    total_inr: 99,
    placed_via: "ui",
    placed_by: null,
    created_at: new Date().toISOString(),
    lang: "en",
  });
  data.order_items.push({
    id: "item-row-two",
    order_id: orderId,
    menu_item_id: itemId,
    name: "Outlet Two Dish",
    unit_price: 99,
    qty: 1,
    notes: null,
    status: "queued",
    gst_pct: 5,
  });
  return { outletId: outlet.id, tableId, categoryId, itemId, sessionId, orderId };
}

describe("staff outlet tenant scope", () => {
  it("lists only the authenticated outlet across admin and staff boards", async () => {
    const { data, repos, ids } = seed();
    const second = addSecondOutlet(data);
    const app = buildApp({ repos });
    const headers = { cookie: staffHeader(data, "admin", second.outletId) };

    const [menu, orders, tables, kitchen, waiter, floor, counter] = await Promise.all([
      app.inject({ url: "/api/admin/menu", headers }),
      app.inject({ url: "/api/admin/orders", headers }),
      app.inject({ url: "/api/admin/tables", headers }),
      app.inject({ url: "/api/kitchen", headers }),
      app.inject({ url: "/api/waiter", headers }),
      app.inject({ url: "/api/floor", headers }),
      app.inject({ url: "/api/counter", headers }),
    ]);

    expect(menu.statusCode).toBe(200);
    expect(menu.json().items.map((row: { id: string }) => row.id)).toEqual([second.itemId]);
    expect(orders.statusCode).toBe(200);
    expect(orders.json().orders.map((row: { id: string }) => row.id)).toEqual([second.orderId]);
    expect(tables.json().tables.map((row: { id: string }) => row.id)).toEqual([second.tableId]);
    expect(kitchen.json().orders.map((row: { id: string }) => row.id)).toEqual([second.orderId]);
    expect(waiter.json().tables.map((row: { tableId: string }) => row.tableId)).toContain(
      second.tableId,
    );
    expect(floor.json().tables.map((row: { id: string }) => row.id)).toEqual([second.tableId]);
    expect(counter.json().tabs.map((row: { sessionId: string }) => row.sessionId)).toEqual([
      second.sessionId,
    ]);
    expect(menu.json().items.map((row: { id: string }) => row.id)).not.toContain(ids.items[0]);
  });

  it("rejects cross-outlet mutation IDs without changing their rows", async () => {
    const { data, repos, ids } = seed();
    const second = addSecondOutlet(data);
    const app = buildApp({ repos });
    const headers = { cookie: staffHeader(data, "admin", second.outletId) };
    const sourceOrderId = "order-one";
    data.orders.push({
      id: sourceOrderId,
      outlet_id: ids.outlet,
      session_id: "session-one",
      status: "placed",
      total_inr: 20,
      placed_via: "ui",
      placed_by: null,
      created_at: new Date().toISOString(),
      lang: "en",
    });
    const sourceItem = data.menu_items.find((row) => row.id === ids.items[0]);
    const sourceTable = data.tables.find((row) => row.id === ids.tableA);
    const sourceOrder = data.orders.find((row) => row.id === sourceOrderId);

    const menu = await app.inject({
      method: "PATCH",
      url: "/api/admin/menu",
      headers,
      payload: { itemId: ids.items[0], is_available: false },
    });
    const table = await app.inject({
      method: "PATCH",
      url: "/api/admin/tables",
      headers,
      payload: { tableId: ids.tableA, label: "must-not-change" },
    });
    const kitchen = await app.inject({
      method: "PATCH",
      url: "/api/kitchen",
      headers,
      payload: { orderId: sourceOrderId, status: "served" },
    });

    expect(menu.statusCode).toBe(404);
    expect(table.statusCode).toBe(404);
    expect(kitchen.statusCode).toBe(404);
    expect(sourceItem?.is_available).toBe(true);
    expect(sourceTable?.label).toBe("Table 1");
    expect(sourceOrder?.status).toBe("placed");
  });

  it("uses session identity for attribution and session outlet for settings", async () => {
    const { data, repos, ids } = seed();
    const second = addSecondOutlet(data);
    const app = buildApp({ repos });
    const headers = { cookie: staffHeader(data, "reception", second.outletId) };
    const adminHeaders = { cookie: staffHeader(data, "admin", second.outletId) };

    const attendant = await app.inject({
      method: "PATCH",
      url: "/api/floor",
      headers,
      payload: { action: "attendant", sessionId: second.sessionId, attendant: "spoofed" },
    });
    const settings = await app.inject({
      method: "PATCH",
      url: "/api/admin/settings",
      headers: { ...adminHeaders, "content-type": "application/json" },
      payload: { outletId: ids.outlet, service_charge_pct: 11 },
    });

    expect(attendant.statusCode).toBe(200);
    expect(data.sessions.find((row) => row.id === second.sessionId)?.attendant).toBe(
      "Demo Reception",
    );
    expect(settings.statusCode).toBe(200);
    expect(data.outlets.find((row) => row.id === second.outletId)?.service_charge_pct).toBe(11);
    expect(data.outlets.find((row) => row.id === ids.outlet)?.service_charge_pct).toBe(5);
  });
});
