import { describe, expect, it } from "vitest";
import { computeBillTotals, type RestaurantRow, type SessionRow } from "./billing";

function baseSession(overrides: Partial<SessionRow> = {}): SessionRow {
  return {
    id: "s1",
    status: "active",
    discount_pct: 10,
    service_waived: false,
    bill_no: null,
    bill_tip: 20,
    settled_at: null,
    restaurant_id: "r1",
    table: { label: "T1" },
    orders: [
      {
        status: "confirmed",
        items: [
          { name: "Item A", qty: 2, unit_price: 100, gst_pct: 5 },
          { name: "Item B", qty: 1, unit_price: 200, gst_pct: 18 },
        ],
      },
      {
        status: "cancelled",
        items: [{ name: "Cancelled Item", qty: 5, unit_price: 50, gst_pct: 5 }],
      },
    ],
    payments: [
      { amount_inr: 100, status: "confirmed" },
      { amount_inr: 50, status: "pending" },
    ],
    ...overrides,
  };
}

const rest: RestaurantRow = { name: "Narada", service_charge_pct: 10, gstin: "GSTIN123" };

describe("computeBillTotals", () => {
  it("computes gross, discount, taxable, per-line gst, gstBreakup, and net with tip override", () => {
    const bill = computeBillTotals(baseSession(), rest, 50);

    expect(bill.gross).toBe(400);
    expect(bill.discountPct).toBe(10);
    expect(bill.discount).toBe(40);
    expect(bill.taxable).toBe(360);

    expect(bill.lines).toHaveLength(2);
    expect(bill.lines[0].lineGst).toBe(9);
    expect(bill.lines[1].lineGst).toBe(32.4);

    expect(bill.gstBreakup).toEqual([
      { pct: 5, taxable: 180, cgst: 4.5, sgst: 4.5 },
      { pct: 18, taxable: 180, cgst: 16.2, sgst: 16.2 },
    ]);
    expect(bill.gst).toBe(41.4);

    expect(bill.serviceChargePct).toBe(10);
    expect(bill.serviceWaived).toBe(false);
    expect(bill.service).toBe(36);

    // tipOverride (50) beats bill_tip (20)
    expect(bill.tip).toBe(50);

    // net = round(360 + 41.4 + 36 + 50) = round(487.4) = 487
    expect(bill.net).toBe(487);
    expect(Number.isInteger(bill.net)).toBe(true);
  });

  it("excludes cancelled orders from lines and totals", () => {
    const bill = computeBillTotals(baseSession(), rest, 50);
    expect(bill.lines.map((l) => l.name)).toEqual(["Item A", "Item B"]);
    expect(bill.lines.find((l) => l.name === "Cancelled Item")).toBeUndefined();
  });

  it("applies service charge when not waived", () => {
    const bill = computeBillTotals(baseSession({ service_waived: false }), rest, 50);
    expect(bill.service).toBe(36);
  });

  it("waives service charge when service_waived is true", () => {
    const bill = computeBillTotals(baseSession({ service_waived: true }), rest, 50);
    expect(bill.service).toBe(0);
    // net = round(360 + 41.4 + 0 + 50) = round(451.4) = 451
    expect(bill.net).toBe(451);
  });

  it("falls back to bill_tip when no tip override is given, and tip is not taxed", () => {
    const bill = computeBillTotals(baseSession({ bill_tip: 20 }), rest, undefined);
    expect(bill.tip).toBe(20);
    // gst (41.4) is unaffected by tip; net = round(360 + 41.4 + 36 + 20) = round(457.4) = 457
    expect(bill.gst).toBe(41.4);
    expect(bill.net).toBe(457);
  });

  it("produces no NaN anywhere when gross is 0 (empty/all-cancelled orders)", () => {
    const session = baseSession({
      orders: [
        {
          status: "cancelled",
          items: [{ name: "Cancelled Item", qty: 5, unit_price: 50, gst_pct: 5 }],
        },
      ],
      bill_tip: 0,
    });
    const bill = computeBillTotals(session, rest, undefined);
    expect(bill.gross).toBe(0);
    expect(bill.discount).toBe(0);
    expect(bill.taxable).toBe(0);
    expect(bill.gst).toBe(0);
    expect(bill.service).toBe(0);
    expect(bill.net).toBe(0);
    expect(bill.lines).toHaveLength(0);
    for (const v of [bill.gross, bill.discount, bill.taxable, bill.gst, bill.service, bill.net]) {
      expect(Number.isNaN(v)).toBe(false);
    }
  });

  it("sums paid only from confirmed payments", () => {
    const bill = computeBillTotals(baseSession(), rest, 50);
    expect(bill.paid).toBe(100);
  });

  it("defaults gst_pct to 5 when null", () => {
    const session = baseSession({
      orders: [
        {
          status: "confirmed",
          items: [
            { name: "No GST item", qty: 1, unit_price: 100, gst_pct: null as unknown as number },
          ],
        },
      ],
      discount_pct: 0,
      bill_tip: 0,
    });
    const bill = computeBillTotals(session, rest, undefined);
    expect(bill.lines[0].gstPct).toBe(5);
    // gross=100, taxable=100, lineGst = 100*5/100 = 5
    expect(bill.lines[0].lineGst).toBe(5);
    expect(bill.gst).toBe(5);
  });
});
