import { describe, expect, it } from "vitest";
import { normalizePhone, validPhone } from "../../src/lib/phone";

describe("phone identity", () => {
  it("removes display punctuation without guessing a country", () => {
    expect(normalizePhone(" +91 (98765)-43210 ")).toBe("+919876543210");
    expect(validPhone("+919876543210")).toBe(true);
    expect(validPhone("919876543210")).toBe(false);
    expect(validPhone("+1 202 555 0100")).toBe(true);
  });
});
