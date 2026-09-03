import { describe, expect, it, vi } from "vitest";
import {
  ackCall,
  clearTable,
  markServed,
  markItemServed,
  waiterBoard,
  waiterRecordPayment,
} from "../../src/services/waiter.js";
import { generateBill } from "../../src/services/settle.js";
import { seed, type FakeDb } from "../helpers/fakeRepos.js";
import type { Repos } from "../../src/repositories/index.js";

function seated(): {
  data: FakeDb;
  repos: Repos;
  sessionId: string;
  tableId: string;
  outletId: string;
} {
  const { data, repos, ids } = seed();
  const sessionId = "aaaaaaaa-2222-0000-0000-000000000001";
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
  const orderId = "bbbbbbbb-2222-0000-0000-000000000001";
  data.orders.push({
    id: orderId,
    session_id: sessionId,
    outlet_id: ids.outlet,
    status: "served",
    total_inr: 400,
    placed_via: "ui",
    created_at: new Date().toISOString(),
    placed_by: null,
    lang: "en",
  });
  data.order_items.push({
    id: "cccccccc-2222-0000-0000-000000000001",
    order_id: orderId,
    menu_item_id: ids.items[0],
    name: "Paneer Tikka",
    unit_price: 400,
    qty: 1,
    notes: null,
    status: "served",
    gst_pct: 5,
  });
  return { data, repos, sessionId, tableId: ids.tableA as string, outletId: ids.outlet };
}

describe("waiterBoard", () => {
  it("shapes every table with its session, due amount and status", async () => {
    const { repos, sessionId, tableId, outletId } = seated();
    const board = await waiterBoard(repos, outletId);
    const row = board.tables.find((t) => t.tableId === tableId);
    expect(row?.session?.id).toBe(sessionId);
    expect(row?.session?.status).toBe("settling");
    expect(row?.session?.due).toBe(440);
    expect(row?.session?.langs).toEqual(["en"]);
  });

  it("shows a free table with no session as free", async () => {
    const { repos, ids } = seed();
    const board = await waiterBoard(repos, ids.outlet);
    const row = board.tables.find((t) => t.tableId === ids.tableB);
    expect(row?.session).toBeNull();
  });

  it("surfaces an open call for its table", async () => {
    const { data, repos, ids } = seed();
    data.waiter_calls.push({
      id: "dddddddd-2222-0000-0000-000000000001",
      table_id: ids.tableA,
      outlet_id: ids.outlet,
      status: "open",
      created_at: new Date().toISOString(),
      acked_at: null,
      acked_by: null,
    });
    const board = await waiterBoard(repos, ids.outlet);
    const row = board.tables.find((t) => t.tableId === ids.tableA);
    expect(row?.call?.table_id).toBe(ids.tableA);
  });
});

describe("ackCall", () => {
  it("acks the call and claims an unclaimed table", async () => {
    const { data, repos, sessionId, tableId, outletId } = seated();
    const callId = "dddddddd-2222-0000-0000-000000000002";
    data.waiter_calls.push({
      id: callId,
      table_id: tableId,
      outlet_id: data.outlets[0].id,
      status: "open",
      created_at: new Date().toISOString(),
      acked_at: null,
      acked_by: null,
    });

    const result = await ackCall(repos, { callId, sessionId }, outletId, "Ravi");
    expect(result).toEqual({ ok: true });
    expect(data.waiter_calls[0].status).toBe("done");
    expect(data.waiter_calls[0].acked_by).toBe("Ravi");
    expect(data.sessions.find((s) => s.id === sessionId)?.attendant).toBe("Ravi");
  });

  it("does not steal a table someone else already claimed", async () => {
    const { data, repos, sessionId, outletId } = seated();
    data.sessions.find((s) => s.id === sessionId)!.attendant = "Priya";
    const callId = "dddddddd-2222-0000-0000-000000000003";
    data.waiter_calls.push({
      id: callId,
      table_id: data.tables[0].id,
      outlet_id: data.outlets[0].id,
      status: "open",
      created_at: new Date().toISOString(),
      acked_at: null,
      acked_by: null,
    });

    await ackCall(repos, { callId, sessionId }, outletId, "Ravi");
    expect(data.sessions.find((s) => s.id === sessionId)?.attendant).toBe("Priya");
  });

  it("acks without a name or table claim", async () => {
    const { data, repos, outletId } = seated();
    const callId = "dddddddd-2222-0000-0000-000000000004";
    data.waiter_calls.push({
      id: callId,
      table_id: data.tables[0].id,
      outlet_id: data.outlets[0].id,
      status: "open",
      created_at: new Date().toISOString(),
      acked_at: null,
      acked_by: null,
    });
    await ackCall(repos, { callId }, outletId, "");
    expect(data.waiter_calls[0].status).toBe("done");
    expect(data.waiter_calls[0].acked_by).toBeNull();
  });
});

describe("markServed", () => {
  it("marks the order and every item served", async () => {
    const { data, repos, ids } = seed();
    const orderId = "bbbbbbbb-2222-0000-0000-000000000002";
    data.orders.push({
      id: orderId,
      session_id: "unused",
      outlet_id: ids.outlet,
      status: "ready",
      total_inr: 200,
      placed_via: "ui",
      created_at: new Date().toISOString(),
      placed_by: null,
      lang: null,
    });
    data.order_items.push({
      id: "cccccccc-2222-0000-0000-000000000002",
      order_id: orderId,
      menu_item_id: ids.items[0],
      name: "Paneer Tikka",
      unit_price: 200,
      qty: 1,
      notes: null,
      status: "ready",
      gst_pct: 5,
    });
    await markServed(repos, orderId, ids.outlet);
    expect(data.orders.find((o) => o.id === orderId)?.status).toBe("served");
    expect(data.order_items[0].status).toBe("served");
  });

  it("does not resurrect an item cancelled after the waiter precheck", async () => {
    const { data, repos, ids } = seed();
    const orderId = "bbbbbbbb-2222-0000-0000-000000000003";
    const itemId = "cccccccc-2222-0000-0000-000000000003";
    data.orders.push({
      id: orderId,
      session_id: "unused",
      outlet_id: ids.outlet,
      status: "ready",
      total_inr: 200,
      placed_via: "ui",
      created_at: new Date().toISOString(),
      placed_by: null,
      lang: null,
    });
    data.order_items.push({
      id: itemId,
      order_id: orderId,
      menu_item_id: ids.items[0],
      name: "Paneer Tikka",
      unit_price: 200,
      qty: 1,
      notes: null,
      status: "ready",
      gst_pct: 5,
    });
    const findForServing = repos.orderItems.findForServing;
    vi.spyOn(repos.orderItems, "findForServing").mockImplementation(async (id, outletId) => {
      const found = await findForServing(id, outletId);
      data.order_items.find((item) => item.id === itemId)!.status = "cancelled";
      return found;
    });
    await expect(markItemServed(repos, itemId, ids.outlet)).rejects.toMatchObject({
      statusCode: 409,
    });
    expect(data.order_items.find((item) => item.id === itemId)?.status).toBe("cancelled");
  });
});

describe("clearTable", () => {
  it("flips needs_cleaning off", async () => {
    const { data, repos, ids } = seed();
    data.tables.find((t) => t.id === ids.tableA)!.needs_cleaning = true;
    await clearTable(repos, ids.tableA, ids.outlet);
    expect(data.tables.find((t) => t.id === ids.tableA)?.needs_cleaning).toBe(false);
  });
});

describe("waiterRecordPayment", () => {
  it("records money against a raised bill, same as the counter's settle service", async () => {
    const { data, repos, sessionId, outletId } = seated();
    await generateBill(repos, sessionId, outletId);
    const result = await waiterRecordPayment(
      repos,
      { sessionId, method: "cash" },
      outletId,
      "Ravi",
    );
    expect(result).toMatchObject({ ok: true, closed: true });
    expect(data.sessions.find((s) => s.id === sessionId)?.status).toBe("closed");
  });
});
