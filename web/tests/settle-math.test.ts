import { describe, expect, it } from "vitest";
import { splitPayment } from "@/lib/settle-math";

describe("splitPayment", () => {
  it("puts an exact payment entirely towards the bill", () => {
    expect(splitPayment(892, 892)).toEqual({ towardsBill: 892, tip: 0 });
  });

  it("treats anything above the bill as a tip", () => {
    // the guest rounded ₹892 up to ₹1,000
    expect(splitPayment(892, 1000)).toEqual({ towardsBill: 892, tip: 108 });
  });

  it("takes a part payment without inventing a tip", () => {
    expect(splitPayment(892, 500)).toEqual({ towardsBill: 500, tip: 0 });
  });

  it("never turns a shortfall into a negative tip", () => {
    expect(splitPayment(892, 0).tip).toBe(0);
    expect(splitPayment(892, -50)).toEqual({ towardsBill: 0, tip: 0 });
  });

  it("charges nothing extra when the bill is already clear", () => {
    expect(splitPayment(0, 0)).toEqual({ towardsBill: 0, tip: 0 });
  });

  it("credits the whole amount when nothing is owed", () => {
    // paying against a settled tab is all tip
    expect(splitPayment(0, 200)).toEqual({ towardsBill: 0, tip: 200 });
  });

  it("works in whole rupees, since that is what is handed over", () => {
    expect(splitPayment(891.5, 1000.4)).toEqual({ towardsBill: 892, tip: 108 });
  });

  it("always splits the full amount received", () => {
    for (const [due, paid] of [
      [892, 1000],
      [500, 500],
      [500, 250],
      [0, 75],
    ]) {
      const s = splitPayment(due, paid);
      expect(s.towardsBill + s.tip).toBe(Math.max(0, Math.round(paid)));
    }
  });
});
