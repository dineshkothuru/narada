import { describe, expect, it } from "vitest";
import { computeTotals, toLines, type RawItem } from "../src/billing-math";

const items = (...rows: [string, number, number, number][]): RawItem[] =>
  rows.map(([name, qty, unit_price, gst_pct]) => ({ name, qty, unit_price, gst_pct }));

const bill = (over: Partial<Parameters<typeof computeTotals>[0]> = {}) =>
  computeTotals({
    lines: toLines(items(["Paneer Tikka", 2, 260, 5], ["Butter Naan", 3, 60, 5])),
    discountPct: 0,
    serviceChargePct: 0,
    serviceWaived: false,
    tip: 0,
    ...over,
  });

describe("computeTotals", () => {
  it("sums the lines into the gross", () => {
    expect(bill().gross).toBe(700); // 2*260 + 3*60
  });

  it("charges GST per item on the pre-discount value when nothing is off", () => {
    const b = bill();
    expect(b.taxable).toBe(700);
    expect(b.gst).toBe(35); // 5% of 700
    expect(b.net).toBe(735);
  });

  it("splits GST evenly into CGST and SGST", () => {
    const [slab] = bill().gstBreakup;
    expect(slab.pct).toBe(5);
    expect(slab.cgst).toBe(17.5);
    expect(slab.sgst).toBe(17.5);
    expect(slab.cgst + slab.sgst).toBe(bill().gst);
  });

  it("keeps a separate slab per GST rate", () => {
    const b = bill({
      lines: toLines(items(["Biryani", 1, 400, 5], ["Bottled water", 2, 50, 18])),
    });
    expect(b.gstBreakup.map((s) => s.pct)).toEqual([5, 18]);
    expect(b.gstBreakup[0].taxable).toBe(400);
    expect(b.gstBreakup[1].taxable).toBe(100);
    expect(b.gst).toBe(38); // 20 + 18
  });

  it("taxes the discounted value, not the gross", () => {
    const b = bill({ discountPct: 10 });
    expect(b.discount).toBe(70);
    expect(b.taxable).toBe(630);
    expect(b.gst).toBe(31.5); // 5% of 630, not of 700
    expect(b.net).toBe(662);
  });

  it("spreads the discount across lines so each keeps its own rate", () => {
    const b = bill({
      discountPct: 50,
      lines: toLines(items(["Biryani", 1, 400, 5], ["Bottled water", 2, 50, 18])),
    });
    // half off: 200 taxed at 5%, 50 taxed at 18%
    expect(b.gstBreakup[0].taxable).toBe(200);
    expect(b.gstBreakup[1].taxable).toBe(50);
    expect(b.gst).toBe(19); // 10 + 9
  });

  it("charges the service charge on the taxable value", () => {
    const b = bill({ serviceChargePct: 10 });
    expect(b.service).toBe(70);
    expect(b.net).toBe(805); // 700 + 35 + 70
  });

  it("drops the service charge entirely when it is waived", () => {
    const b = bill({ serviceChargePct: 10, serviceWaived: true });
    expect(b.service).toBe(0);
    expect(b.net).toBe(735);
  });

  it("never taxes the tip", () => {
    const plain = bill();
    const tipped = bill({ tip: 100 });
    expect(tipped.gst).toBe(plain.gst);
    expect(tipped.service).toBe(plain.service);
    expect(tipped.net).toBe(plain.net + 100);
  });

  it("applies service charge before the tip, and taxes neither the tip", () => {
    const b = bill({ discountPct: 10, serviceChargePct: 5, tip: 50 });
    expect(b.taxable).toBe(630);
    expect(b.gst).toBe(31.5);
    expect(b.service).toBe(31.5);
    expect(b.net).toBe(743); // round(630 + 31.5 + 31.5 + 50)
  });

  it("rounds only the final payable, to the rupee", () => {
    const b = bill({ lines: toLines(items(["Chai", 3, 33, 5])) });
    expect(b.gross).toBe(99);
    // 5% of 99 is 4.95, but CGST and SGST are each rounded to the paisa on the
    // invoice (2.48 + 2.48), so the GST line is what the guest actually pays
    expect(b.gst).toBe(4.96);
    expect(b.net).toBe(104); // 103.96 rounded
  });

  it("keeps the GST line equal to the CGST/SGST actually printed", () => {
    for (const lines of [
      toLines(items(["Chai", 3, 33, 5])),
      toLines(items(["Biryani", 1, 401, 5], ["Water", 3, 17, 18])),
    ]) {
      const b = computeTotals({
        lines,
        discountPct: 7,
        serviceChargePct: 0,
        serviceWaived: false,
        tip: 0,
      });
      const printed = b.gstBreakup.reduce((n, g) => n + g.cgst + g.sgst, 0);
      expect(b.gst).toBeCloseTo(printed, 10);
    }
  });

  it("handles an empty tab without dividing by zero", () => {
    const b = bill({ lines: [], discountPct: 20, serviceChargePct: 10 });
    expect(b.gross).toBe(0);
    expect(b.gst).toBe(0);
    expect(b.service).toBe(0);
    expect(b.net).toBe(0);
    expect(b.gstBreakup).toEqual([]);
  });

  it("does not mutate the lines it is given", () => {
    const lines = toLines(items(["Paneer Tikka", 1, 260, 5]));
    computeTotals({
      lines,
      discountPct: 0,
      serviceChargePct: 0,
      serviceWaived: false,
      tip: 0,
    });
    expect(lines[0].lineGst).toBe(0);
  });

  it("defaults a missing GST rate to the outlet standard of 5%", () => {
    const [line] = toLines([{ name: "Mystery", qty: 1, unit_price: 100 } as unknown as RawItem]);
    expect(line.gstPct).toBe(5);
  });
});
