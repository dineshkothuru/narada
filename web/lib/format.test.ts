import { describe, expect, it } from "vitest";
import { inr, minutesAgo } from "./format";

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
