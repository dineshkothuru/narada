import { afterEach, describe, expect, it, vi } from "vitest";
import { MEMORY_EMOJIS, MEMORY_LEVELS, WHEEL, spinWheel } from "../src/games";

afterEach(() => {
  vi.restoreAllMocks();
});

describe("spinWheel", () => {
  it("always returns an index within range", () => {
    for (let i = 0; i < 200; i++) {
      const idx = spinWheel();
      expect(idx).toBeGreaterThanOrEqual(0);
      expect(idx).toBeLessThan(WHEEL.length);
    }
  });

  it("returns index 0 when Math.random is mocked to 0", () => {
    vi.spyOn(Math, "random").mockReturnValue(0);
    expect(spinWheel()).toBe(0);
  });

  it("returns the last index when Math.random is mocked to 0.9999", () => {
    vi.spyOn(Math, "random").mockReturnValue(0.9999);
    expect(spinWheel()).toBe(WHEEL.length - 1);
  });
});

describe("WHEEL", () => {
  it("has all positive integer weights", () => {
    for (const slice of WHEEL) {
      expect(Number.isInteger(slice.weight)).toBe(true);
      expect(slice.weight).toBeGreaterThan(0);
    }
  });
});

describe("MEMORY_LEVELS", () => {
  it("has pairs that fit within MEMORY_EMOJIS length", () => {
    for (const level of MEMORY_LEVELS) {
      expect(level.pairs).toBeLessThanOrEqual(MEMORY_EMOJIS.length);
    }
  });
});
