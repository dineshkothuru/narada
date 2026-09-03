import { describe, expect, it } from "vitest";
import {
  counterBoard,
  counterGenerateBill,
  counterRecordPayment,
  waiveService,
} from "../../src/services/counter.js";
import { seed, type FakeDb } from "../helpers/fakeRepos.js";
import type { Repos } from "../../src/repositories/index.js";

function seated(): { data: FakeDb; repos: Repos; sessionId: string } {
  const { data, repos, ids } = seed();
  const sessionId = "aaaaaaaa-4444-0000-0000-000000000001";
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
    attendant: "Ravi",
    merged_into: null,
    service_waived: false,
    bill_no: null,
    bill_tip: null,
    tip_to: null,
    settled_at: null,
  });
  const orderId = "bbbbbbbb-4444-0000-0000-000000000001";
  data.orders.push({
    id: orderId,
    session_id: sessionId,
    outlet_id: ids.outlet,
    status: "served",
    total_inr: 400,
    placed_via: "ui",
    created_at: new Date().toISOString(),
    placed_by: null,
    lang: null,
  });
  data.order_items.push({
    id: "cccccccc-4444-0000-0000-000000000001",
    order_id: orderId,
    menu_item_id: ids.items[0],
    name: "Paneer Tikka",
    unit_price: 400,
    qty: 1,
    notes: null,
    status: "served",
    gst_pct: 5,
  });
  return { data, repos, sessionId };
}

describe("counterBoard", () => {
  it("lists the active tabs sorted by unserved then due", async () => {
    const { repos, sessionId } = seated();
    const board = await counterBoard(repos);
    const row = board.tabs.find((t) => t.sessionId === sessionId);
    expect(row).toMatchObject({ due: 440, unserved: 0, rounds: 1 });
  });

  it("hides a merged tab and shows its label under the primary", async () => {
    const { data, repos, sessionId } = seated();
    const joinedTable = data.tables[1].id as string;
    const joinedSession = "aaaaaaaa-4444-0000-0000-000000000002";
    data.sessions.push({
      id: joinedSession,
      table_id: joinedTable,
      outlet_id: data.outlets[0].id,
      status: "active",
      created_at: new Date().toISOString(),
      closed_at: null,
      discount_pct: 0,
      comp_awarded: false,
      guests: 2,
      attendant: null,
      merged_into: sessionId,
      service_waived: false,
      bill_no: null,
      bill_tip: null,
      tip_to: null,
      settled_at: null,
    });

    const board = await counterBoard(repos);
    expect(board.tabs.find((t) => t.sessionId === joinedSession)).toBeUndefined();
    expect(board.tabs.find((t) => t.sessionId === sessionId)?.mergedWith).toEqual(["Table 2"]);
  });
});

describe("waiveService", () => {
  it("sets the waived flag", async () => {
    const { data, repos, sessionId } = seated();
    await waiveService(repos, sessionId, true);
    expect(data.sessions[0].service_waived).toBe(true);
  });

  it("defaults to false when waived is omitted", async () => {
    const { data, repos, sessionId } = seated();
    await waiveService(repos, sessionId);
    expect(data.sessions[0].service_waived).toBe(false);
  });
});

describe("counterGenerateBill / counterRecordPayment", () => {
  it("raises a bill and then settles it, same as the settle service", async () => {
    const { data, repos, sessionId } = seated();
    const bill = await counterGenerateBill(repos, sessionId);
    expect(bill.ok).toBe(true);
    expect(data.sessions[0].bill_no).toBe(bill.billNo);

    const result = await counterRecordPayment(repos, { sessionId, method: "card" });
    expect(result).toMatchObject({ ok: true, closed: true });
    expect(data.sessions[0].status).toBe("closed");
  });
});
