import { describe, expect, it } from "vitest";
import { generateBill, recordPayment } from "../../src/services/settle.js";
import { seed, type FakeDb } from "../helpers/fakeRepos.js";
import type { Repos } from "../../src/repositories/index.js";

// A table with one served round of 400, no discount, 5% service charge.
// gross 400 + gst 20 + service 20 = net 440.
function seated(): { data: FakeDb; repos: Repos; sessionId: string; tableId: string } {
  const { data, repos, ids } = seed();
  const sessionId = "aaaaaaaa-0000-0000-0000-000000000001";
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
  const orderId = "bbbbbbbb-0000-0000-0000-000000000001";
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
    id: "cccccccc-0000-0000-0000-000000000001",
    order_id: orderId,
    menu_item_id: ids.items[0],
    name: "Paneer Tikka",
    unit_price: 400,
    qty: 1,
    notes: null,
    status: "served",
    gst_pct: 5,
  });
  return { data, repos, sessionId, tableId: ids.tableA as string };
}

describe("generateBill", () => {
  it("freezes the totals and mints an invoice number", async () => {
    const { data, repos, sessionId } = seated();
    const result = await generateBill(repos, sessionId);
    expect(result.ok).toBe(true);
    expect(result.billNo).toMatch(/^NAR-\d{8}-0001$/);
    expect(result.net).toBe(440);
    expect(data.sessions[0].bill_no).toBe(result.billNo);
  });

  it("refuses to mint a second invoice number on a double tap", async () => {
    const { repos, sessionId } = seated();
    await generateBill(repos, sessionId);
    await expect(generateBill(repos, sessionId)).rejects.toMatchObject({
      statusCode: 409,
      message: "bill already raised",
    });
  });

  it("404s an unknown session", async () => {
    const { repos } = seed();
    await expect(generateBill(repos, "00000000-0000-0000-0000-000000000000")).rejects.toMatchObject(
      { statusCode: 404 },
    );
  });
});

describe("recordPayment", () => {
  it("refuses money before a bill has been raised", async () => {
    const { repos, sessionId } = seated();
    await expect(recordPayment(repos, { sessionId })).rejects.toMatchObject({
      statusCode: 409,
      message: "no bill has been raised for this table yet",
    });
  });

  it("settles the full amount, closes the tab and flags the table for cleaning", async () => {
    const { data, repos, sessionId, tableId } = seated();
    await generateBill(repos, sessionId);

    const result = await recordPayment(repos, { sessionId, method: "cash", collectedBy: "Ravi" });
    expect(result).toMatchObject({ ok: true, due: 0, closed: true });
    expect(data.sessions[0].status).toBe("closed");
    expect(data.sessions[0].closed_at).toBeTruthy();
    expect(data.tables.find((t) => t.id === tableId)?.needs_cleaning).toBe(true);

    const payment = data.payments[0];
    expect(Number(payment.amount_inr)).toBe(440);
    expect(payment.method).toBe("cash");
    expect(payment.status).toBe("confirmed");
    expect(payment.reference).toContain("collected by Ravi");
  });

  it("keeps the tab open on a part payment", async () => {
    const { data, repos, sessionId } = seated();
    await generateBill(repos, sessionId);

    const first = await recordPayment(repos, { sessionId, amount: 200 });
    expect(first).toMatchObject({ ok: true, due: 240, closed: false });
    expect(data.sessions[0].status).toBe("active");

    const second = await recordPayment(repos, { sessionId, amount: 240 });
    expect(second).toMatchObject({ ok: true, due: 0, closed: true });
    expect(data.sessions[0].status).toBe("closed");
  });

  it("closes the whole merged group and flags every table in it", async () => {
    const { data, repos, sessionId, tableId } = seated();
    const joinedTable = data.tables[1].id as string;
    const joinedSession = "aaaaaaaa-0000-0000-0000-000000000002";
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

    await generateBill(repos, sessionId);
    const result = await recordPayment(repos, { sessionId });
    expect(result.closed).toBe(true);

    expect(data.sessions.find((s) => s.id === joinedSession)?.status).toBe("closed");
    expect(data.tables.find((t) => t.id === tableId)?.needs_cleaning).toBe(true);
    expect(data.tables.find((t) => t.id === joinedTable)?.needs_cleaning).toBe(true);
  });

  it("refuses a payment against an already closed tab", async () => {
    const { data, repos, sessionId } = seated();
    data.sessions[0].status = "closed";
    await expect(recordPayment(repos, { sessionId })).rejects.toMatchObject({
      statusCode: 409,
      message: "already closed",
    });
  });

  it("records the UTR on a UPI payment", async () => {
    const { data, repos, sessionId } = seated();
    await generateBill(repos, sessionId);
    await recordPayment(repos, { sessionId, method: "upi_intent", utr: "  123456789  " });
    expect(data.payments[0].reference).toContain("UTR 123456789");
    expect(data.payments[0].method).toBe("upi_intent");
  });
});

// Main changed how tips work: the counter raises a plain bill and whatever the
// guest pays above it becomes the tip, credited to whoever served the table.
describe("overpayment becomes a tip", () => {
  it("credits the round-up to the attendant and grows the frozen invoice", async () => {
    const { data, repos, sessionId } = seated();
    data.sessions[0].attendant = "Ravi";
    await generateBill(repos, sessionId);
    expect(data.sessions[0].bill_tip).toBe(0);

    // bill is 440, the guest sends 500
    const result = await recordPayment(repos, { sessionId, amount: 500, method: "upi_intent" });
    expect(result).toMatchObject({ ok: true, closed: true });

    expect(data.sessions[0].bill_tip).toBe(60);
    expect(data.sessions[0].bill_net).toBe(500);
    expect(data.sessions[0].tip_to).toBe("Ravi");
    expect(data.payments[0].reference).toContain("incl. tip ₹60");
  });

  it("leaves an exact payment untouched", async () => {
    const { data, repos, sessionId } = seated();
    await generateBill(repos, sessionId);
    await recordPayment(repos, { sessionId, amount: 440 });

    expect(data.sessions[0].bill_tip).toBe(0);
    expect(data.sessions[0].tip_to).toBeNull();
    expect(data.payments[0].reference).not.toContain("incl. tip");
  });

  it("keeps an already-frozen tip_to rather than moving the money", async () => {
    const { data, repos, sessionId } = seated();
    data.sessions[0].attendant = "Meera";
    await generateBill(repos, sessionId);
    data.sessions[0].tip_to = "Ravi";

    await recordPayment(repos, { sessionId, amount: 500 });
    expect(data.sessions[0].tip_to).toBe("Ravi");
  });

  it("treats a part payment as no tip at all", async () => {
    const { data, repos, sessionId } = seated();
    await generateBill(repos, sessionId);
    const first = await recordPayment(repos, { sessionId, amount: 200 });
    expect(first).toMatchObject({ closed: false });
    expect(data.sessions[0].bill_tip).toBe(0);
  });
});
