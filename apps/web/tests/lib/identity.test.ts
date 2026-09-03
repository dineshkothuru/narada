import { describe, expect, it } from "vitest";
import { codePointLength, limitCodePoints, validUsername } from "../../src/lib/identity";

describe("staff identity validation", () => {
  it("counts name characters as Unicode code points", () => {
    expect(codePointLength("😀".repeat(60))).toBe(60);
    expect(codePointLength("😀".repeat(61))).toBe(61);
  });

  it("limits name fields without splitting astral characters", () => {
    const sixty = limitCodePoints("😀".repeat(60), 60);
    const over = limitCodePoints("😀".repeat(61), 60);
    expect(codePointLength(sixty)).toBe(60);
    expect(codePointLength(over)).toBe(60);
    expect(over).toBe(sixty);
  });

  it("accepts only canonical username characters", () => {
    expect(validUsername("maya.server")).toBe(true);
    expect(validUsername("Maya.Server")).toBe(false);
    expect(validUsername("maya server")).toBe(false);
  });
});
