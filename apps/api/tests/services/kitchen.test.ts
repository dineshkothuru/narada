import { orderToken } from "@narada/shared";
import { describe, expect, it, vi } from "vitest";
import { kitchenOrders, updateItemStatus, updateOrderStatus } from "../../src/services/kitchen.js";
import { seed, type FakeDb } from "../helpers/fakeRepos.js";
import type { Repos } from "../../src/repositories/index.js";

function ticket(): { data: FakeDb; repos: Repos; orderId: string; itemId: string } {
  const { data, repos, ids } = seed();
  const sessionId = "aaaaaaaa-1111-0000-0000-000000000001";
  data.sessions.push({
    id: sessionId,
    table_id: ids.tableA,
    outlet_id: ids.outlet,
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
  const orderId = "bbbbbbbb-1111-0000-0000-000000000001";
  data.orders.push({
    id: orderId,
    session_id: sessionId,
    outlet_id: ids.outlet,
    status: "placed",
    total_inr: 400,
    placed_via: "ui",
    created_at: new Date().toISOString(),
    placed_by: null,
    lang: "en",
  });
  const itemId = "cccccccc-1111-0000-0000-000000000001";
  data.order_items.push({
    id: itemId,
    order_id: orderId,
    menu_item_id: ids.items[0],
    name: "Paneer Tikka",
    unit_price: 400,
    qty: 1,
    notes: null,
    status: "queued",
    gst_pct: 5,
  });
  return { data, repos, orderId, itemId };
}

describe("kitchenOrders", () => {
  it("lists open tickets", async () => {
    const { repos, orderId, data } = ticket();
    const orders = await kitchenOrders(repos, 60, data.outlets[0].id as string);
    const order = orders.find((o) => o.id === orderId);
    expect(order?.orderNo).toBe(orderToken(orderId));
  });
});

describe("updateItemStatus", () => {
  it("sets the dish and derives the ticket status from its siblings", async () => {
    const { data, repos, orderId, itemId } = ticket();
    const result = await updateItemStatus(repos, itemId, "preparing", data.outlets[0].id as string);
    expect(result).toEqual({ ok: true, orderStatus: "preparing" });
    expect(data.order_items[0].status).toBe("preparing");
    expect(data.orders.find((o) => o.id === orderId)?.status).toBe("preparing");
  });

  it("advances the ticket to served only once every dish is served", async () => {
    const { data, repos, orderId, itemId } = ticket();
    const secondItemId = "cccccccc-1111-0000-0000-000000000002";
    data.order_items.push({
      id: secondItemId,
      order_id: orderId,
      menu_item_id: data.order_items[0].menu_item_id,
      name: "Veg Manchurian",
      unit_price: 240,
      qty: 1,
      notes: null,
      status: "queued",
      gst_pct: 5,
    });

    await updateItemStatus(repos, itemId, "served", data.outlets[0].id as string);
    expect(data.orders.find((o) => o.id === orderId)?.status).toBe("preparing");

    const result = await updateItemStatus(
      repos,
      secondItemId,
      "served",
      data.outlets[0].id as string,
    );
    expect(result.orderStatus).toBe("served");
    expect(data.orders.find((o) => o.id === orderId)?.status).toBe("served");
  });

  it("404s an unknown item", async () => {
    const { repos, data } = ticket();
    await expect(
      updateItemStatus(
        repos,
        "00000000-0000-0000-0000-000000000000",
        "ready",
        data.outlets[0].id as string,
      ),
    ).rejects.toMatchObject({ statusCode: 404, message: "unknown item" });
  });

  it("does not overwrite an item cancelled after the stale precheck", async () => {
    const { data, repos, orderId, itemId } = ticket();
    const findOrderId = repos.orderItems.findOrderId;
    vi.spyOn(repos.orderItems, "findOrderId").mockImplementation(async (id, outletId) => {
      const found = await findOrderId(id, outletId);
      data.order_items.find((item) => item.id === itemId)!.status = "cancelled";
      return found;
    });
    await expect(
      updateItemStatus(repos, itemId, "served", data.outlets[0].id as string),
    ).rejects.toMatchObject({ statusCode: 409 });
    expect(data.order_items.find((item) => item.id === itemId)?.status).toBe("cancelled");
    expect(data.orders.find((order) => order.id === orderId)?.status).toBe("placed");
  });
});

describe("updateOrderStatus", () => {
  it("dragging to preparing only moves dishes that are still queued", async () => {
    const { data, repos, orderId, itemId } = ticket();
    data.order_items.push({
      id: "cccccccc-1111-0000-0000-000000000003",
      order_id: orderId,
      menu_item_id: data.order_items[0].menu_item_id,
      name: "Gulab Jamun",
      unit_price: 120,
      qty: 1,
      notes: null,
      status: "ready", // already ahead, should not be dragged backwards
      gst_pct: 18,
    });

    await updateOrderStatus(repos, orderId, "preparing", data.outlets[0].id as string);
    expect(data.orders.find((o) => o.id === orderId)?.status).toBe("preparing");
    expect(data.order_items.find((it) => it.id === itemId)?.status).toBe("preparing");
    expect(data.order_items.find((it) => it.name === "Gulab Jamun")?.status).toBe("ready");
  });

  it("dragging to ready or served moves every dish at once", async () => {
    const { data, repos, orderId } = ticket();
    await updateOrderStatus(repos, orderId, "served", data.outlets[0].id as string);
    expect(data.orders.find((o) => o.id === orderId)?.status).toBe("served");
    expect(data.order_items.every((it) => it.status === "served")).toBe(true);
  });

  it("does not resurrect an item that was cancelled", async () => {
    const { data, repos, orderId, itemId } = ticket();
    data.order_items.find((it) => it.id === itemId)!.status = "cancelled";
    await updateOrderStatus(repos, orderId, "served", data.outlets[0].id as string);
    expect(data.order_items.find((it) => it.id === itemId)?.status).toBe("cancelled");
    expect(data.orders.find((o) => o.id === orderId)?.status).toBe("cancelled");
  });

  it("requires item cancellation instead of bypassing the canonical guard", async () => {
    const { data, repos, orderId } = ticket();
    await expect(
      updateOrderStatus(repos, orderId, "cancelled", data.outlets[0].id as string),
    ).rejects.toMatchObject({ statusCode: 409 });
  });
});
