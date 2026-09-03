import { randomUUID } from "node:crypto";
import { orderToken } from "@narada/shared";
import { describe, expect, it } from "vitest";
import { getOrderStatus, getSessionOrders, placeOrder } from "../../src/services/order.js";
import { seed } from "../helpers/fakeRepos.js";

describe("placeOrder", () => {
  it("places an order for a known table with valid cart items", async () => {
    const { data, repos, ids } = seed();
    const result = await placeOrder(repos, {
      tableCode: "t1-demo",
      cart: [
        { itemId: ids.items[0], qty: 2 },
        { itemId: ids.items[2], qty: 1 },
      ],
    });

    expect(result.total).toBe(280 * 2 + 120);
    expect(result.tableLabel).toBe("Table 1");
    expect(result.discountPct).toBe(0);
    expect(result.orderNo).toBe(orderToken(result.orderId));
    expect(data.orders).toHaveLength(1);
    expect(data.order_items).toHaveLength(2);
    expect(data.sessions).toHaveLength(1);
  });

  it("clamps and drops invalid quantities, keeping only valid lines", async () => {
    const { data, repos, ids } = seed();
    const result = await placeOrder(repos, {
      tableCode: "t1-demo",
      cart: [
        { itemId: ids.items[0], qty: 3.7 }, // floored to 3
        { itemId: ids.items[1], qty: 0 }, // dropped: qty must be > 0
        { itemId: ids.items[2], qty: 999 }, // dropped: qty must be <= 50
      ],
    });
    expect(result.total).toBe(280 * 3);
    expect(data.order_items).toHaveLength(1);
    expect(data.order_items[0].qty).toBe(3);
  });

  it("rejects a cart with no valid item ids", async () => {
    const { repos } = seed();
    await expect(
      placeOrder(repos, { tableCode: "t1-demo", cart: [{ itemId: "not-a-uuid", qty: 1 }] }),
    ).rejects.toMatchObject({ statusCode: 400, message: "no valid items" });
  });

  it("rejects a cart whose items don't exist in the menu", async () => {
    const { repos } = seed();
    await expect(
      placeOrder(repos, {
        tableCode: "t1-demo",
        cart: [{ itemId: "99999999-9999-9999-9999-999999999999", qty: 1 }],
      }),
    ).rejects.toMatchObject({ statusCode: 400, message: "no valid items" });
  });

  it("rejects a valid item id belonging to another outlet", async () => {
    const { data, repos } = seed();
    const foreignOutlet = randomUUID();
    const foreignItem = randomUUID();
    data.outlets.push({ id: foreignOutlet, name: "Other outlet" });
    data.menu_items.push({
      id: foreignItem,
      outlet_id: foreignOutlet,
      name: "Foreign dish",
      price_inr: 999,
      gst_pct: 5,
    });

    await expect(
      placeOrder(repos, {
        tableCode: "t1-demo",
        cart: [{ itemId: foreignItem, qty: 1 }],
      }),
    ).rejects.toMatchObject({ statusCode: 400, message: "no valid items" });
    expect(data.orders).toHaveLength(0);
  });

  it("rejects an unknown table", async () => {
    const { repos, ids } = seed();
    await expect(
      placeOrder(repos, { tableCode: "nope", cart: [{ itemId: ids.items[0], qty: 1 }] }),
    ).rejects.toMatchObject({ statusCode: 404, message: "unknown table" });
  });

  it("joins the table's existing active session rather than starting a new one", async () => {
    const { data, repos, ids } = seed();
    const first = await placeOrder(repos, {
      tableCode: "t1-demo",
      cart: [{ itemId: ids.items[0], qty: 1 }],
    });
    const second = await placeOrder(repos, {
      tableCode: "t1-demo",
      cart: [{ itemId: ids.items[1], qty: 1 }],
    });
    expect(second.sessionId).toBe(first.sessionId);
    expect(data.sessions).toHaveLength(1);
    expect(data.orders).toHaveLength(2);
  });
});

describe("getSessionOrders", () => {
  it("returns rounds with their items and the session discount/status", async () => {
    const { data, repos, ids } = seed();
    const placed = await placeOrder(repos, {
      tableCode: "t1-demo",
      cart: [{ itemId: ids.items[0], qty: 2 }],
    });
    const view = await getSessionOrders(repos, placed.sessionId, undefined, ids.outlet);
    expect(view.rounds).toHaveLength(1);
    expect(view.rounds[0].orderNo).toBe(orderToken(view.rounds[0].id));
    expect(view.rounds[0].items).toEqual([
      { id: data.order_items[0].id, name: "Paneer Tikka", qty: 2, status: "queued" },
    ]);
    expect(view.discountPct).toBe(0);
    expect(view.sessionStatus).toBe("active");
  });

  it("excludes cancelled rounds", async () => {
    const { data, repos, ids } = seed();
    const placed = await placeOrder(repos, {
      tableCode: "t1-demo",
      cart: [{ itemId: ids.items[0], qty: 1 }],
    });
    data.orders[0].status = "cancelled";
    const view = await getSessionOrders(repos, placed.sessionId, undefined, ids.outlet);
    expect(view.rounds).toHaveLength(0);
  });
});

describe("getOrderStatus", () => {
  it("returns the status of a known order", async () => {
    const { repos, ids } = seed();
    const placed = await placeOrder(repos, {
      tableCode: "t1-demo",
      cart: [{ itemId: ids.items[0], qty: 1 }],
    });
    expect(await getOrderStatus(repos, placed.orderId, undefined, ids.outlet)).toEqual({
      status: "placed",
    });
  });

  it("rejects an unknown order id with a 404", async () => {
    const { repos, ids } = seed();
    await expect(
      getOrderStatus(repos, "99999999-9999-9999-9999-999999999999", undefined, ids.outlet),
    ).rejects.toMatchObject({ statusCode: 404, message: "not found" });
  });
});
