import { describe, expect, it } from "vitest";
import { computeBill, finalizeBill } from "../../src/services/billing.js";
import { seed } from "../helpers/fakeRepos.js";

// A round of two dishes at different GST slabs, so the per-item rate actually
// matters rather than collapsing to a single rate.
function tableWithOrder(discountPct = 0) {
  const { data, repos, ids } = seed();
  const sessionId = "11111111-1111-1111-1111-111111111111";
  data.sessions.push({
    id: sessionId,
    table_id: ids.tableA,
    outlet_id: ids.outlet,
    status: "active",
    created_at: new Date().toISOString(),
    closed_at: null,
    discount_pct: discountPct,
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
  const orderId = "22222222-2222-2222-2222-222222222222";
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
  data.order_items.push(
    {
      id: "33333333-3333-3333-3333-333333333331",
      order_id: orderId,
      menu_item_id: ids.items[0],
      name: "Paneer Tikka",
      unit_price: 280,
      qty: 1,
      notes: null,
      status: "served",
      gst_pct: 5,
    },
    {
      id: "33333333-3333-3333-3333-333333333332",
      order_id: orderId,
      menu_item_id: ids.items[2],
      name: "Gulab Jamun (2 pcs)",
      unit_price: 120,
      qty: 1,
      notes: null,
      status: "served",
      gst_pct: 18,
    },
  );
  return { data, repos, ids, sessionId, orderId };
}

describe("computeBill", () => {
  it("totals a round with two GST slabs and the outlet service charge", async () => {
    const { repos, sessionId } = tableWithOrder();
    const bill = await computeBill(repos, sessionId);

    expect(bill.gross).toBe(400);
    expect(bill.discount).toBe(0);
    expect(bill.taxable).toBe(400);
    // 5% of 280 = 14, 18% of 120 = 21.6
    expect(bill.gst).toBe(35.6);
    expect(bill.gstBreakup.map((g) => g.pct)).toEqual([5, 18]);
    expect(bill.serviceChargePct).toBe(5);
    expect(bill.service).toBe(20);
    expect(bill.net).toBe(Math.round(400 + 35.6 + 20));
    expect(bill.tableLabel).toBe("Table 1");
    expect(bill.gstin).toBe("36AAAAA0000A1Z5");
    expect(bill.paid).toBe(0);
  });

  it("spreads a discount across the lines before taxing them", async () => {
    const { repos, sessionId } = tableWithOrder(10);
    const bill = await computeBill(repos, sessionId);
    expect(bill.discount).toBe(40);
    expect(bill.taxable).toBe(360);
    // both slabs shrink by the same factor
    expect(bill.gst).toBe(32.04);
    expect(bill.service).toBe(18);
  });

  it("waives the service charge when the guest asks", async () => {
    const { data, repos, sessionId } = tableWithOrder();
    data.sessions[0].service_waived = true;
    const bill = await computeBill(repos, sessionId);
    expect(bill.service).toBe(0);
    expect(bill.serviceWaived).toBe(true);
  });

  it("ignores cancelled rounds and counts only confirmed payments", async () => {
    const { data, repos, sessionId, ids } = tableWithOrder();
    data.orders.push({
      id: "44444444-4444-4444-4444-444444444444",
      session_id: sessionId,
      outlet_id: ids.outlet,
      status: "cancelled",
      total_inr: 999,
      placed_via: "ui",
      created_at: new Date().toISOString(),
      placed_by: null,
      lang: null,
    });
    data.order_items.push({
      id: "55555555-5555-5555-5555-555555555555",
      order_id: "44444444-4444-4444-4444-444444444444",
      menu_item_id: ids.items[1],
      name: "Veg Manchurian",
      unit_price: 999,
      qty: 1,
      notes: null,
      status: "queued",
      gst_pct: 5,
    });
    data.payments.push(
      { id: "p1", session_id: sessionId, amount_inr: 100, status: "confirmed", method: "cash" },
      { id: "p2", session_id: sessionId, amount_inr: 50, status: "pending", method: "upi_intent" },
    );

    const bill = await computeBill(repos, sessionId);
    expect(bill.gross).toBe(400);
    expect(bill.paid).toBe(100);
  });

  it("rejects an unknown session with a 404", async () => {
    const { repos } = seed();
    await expect(computeBill(repos, "99999999-9999-9999-9999-999999999999")).rejects.toMatchObject({
      statusCode: 404,
      message: "unknown session",
    });
  });

  it("adds the tip after tax and never taxes it", async () => {
    const { repos, sessionId } = tableWithOrder();
    const withTip = await computeBill(repos, sessionId, 50);
    const withoutTip = await computeBill(repos, sessionId, 0);
    expect(withTip.tip).toBe(50);
    expect(withTip.gst).toBe(withoutTip.gst);
    expect(withTip.net).toBe(withoutTip.net + 50);
  });
});

describe("finalizeBill", () => {
  it("mints a sequential invoice number and freezes the totals", async () => {
    const { data, repos, sessionId, ids } = tableWithOrder();
    const bill = await finalizeBill(repos, sessionId, 40, ids.outlet);

    expect(bill.billNo).toMatch(/^NAR-\d{8}-0001$/);
    expect(data.outlets[0].bill_seq).toBe(1);

    const session = data.sessions[0];
    expect(session.bill_no).toBe(bill.billNo);
    expect(session.bill_gross).toBe(400);
    expect(session.bill_net).toBe(bill.net);
    expect(session.bill_tip).toBe(40);
    // whoever was attending earns the tip, frozen at bill time
    expect(session.tip_to).toBe("Ravi");
    expect(session.settled_at).toBeTruthy();
  });

  it("leaves tip_to null when no tip was given", async () => {
    const { data, repos, sessionId, ids } = tableWithOrder();
    await finalizeBill(repos, sessionId, 0, ids.outlet);
    expect(data.sessions[0].tip_to).toBeNull();
  });
});
