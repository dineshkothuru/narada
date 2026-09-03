import { describe, expect, it } from "vitest";
import { inr, minutesAgo, orderToken } from "../src/format";

describe("orderToken", () => {
  it("formats the first eight UUID characters as an uppercase token", () => {
    expect(orderToken("a1b2c3d4-1234-5678-9abc-def012345678")).toBe("A1B2C3D4");
  });
});

describe("inr", () => {
  it("formats a number as Indian rupees with grouping", () => {
    expect(inr(1000)).toBe("₹1,000");
  });

  it("formats large numbers with Indian digit grouping", () => {
    expect(inr(1234567)).toBe("₹12,34,567");
  });

  it("formats zero", () => {
    expect(inr(0)).toBe("₹0");
  });
});

describe("minutesAgo", () => {
  it("returns 'just now' for the current time", () => {
    const now = new Date().toISOString();
    expect(minutesAgo(now)).toBe("just now");
  });

  it("returns 'now' for the current time when compact", () => {
    const now = new Date().toISOString();
    expect(minutesAgo(now, true)).toBe("now");
  });

  it("returns minutes elapsed for a past timestamp", () => {
    const fiveMinAgo = new Date(Date.now() - 5 * 60000).toISOString();
    expect(minutesAgo(fiveMinAgo)).toBe("5 min ago");
  });

  it("returns compact minutes elapsed for a past timestamp", () => {
    const fiveMinAgo = new Date(Date.now() - 5 * 60000).toISOString();
    expect(minutesAgo(fiveMinAgo, true)).toBe("5m");
  });

  it("clamps future timestamps to zero minutes", () => {
    const future = new Date(Date.now() + 5 * 60000).toISOString();
    expect(minutesAgo(future)).toBe("just now");
  });
});
