import { describe, expect, it } from "vitest";
import { sanitizeCartLines, validItemIds } from "../src/cart";
import type { CartLine } from "../src/types";

const ID1 = "11111111-1111-1111-1111-111111111111";
const ID2 = "22222222-2222-2222-2222-222222222222";

describe("validItemIds", () => {
  it("drops malformed uuids", () => {
    const cart: CartLine[] = [
      { itemId: "not-a-uuid", qty: 1 },
      { itemId: ID1, qty: 1 },
    ];
    expect(validItemIds(cart)).toEqual([ID1]);
  });

  it("dedupes item ids", () => {
    const cart: CartLine[] = [
      { itemId: ID1, qty: 1 },
      { itemId: ID1, qty: 2 },
      { itemId: ID2, qty: 1 },
    ];
    expect(validItemIds(cart)).toEqual([ID1, ID2]);
  });
});

describe("sanitizeCartLines", () => {
  const known = new Set([ID1, ID2]);

  it("floors fractional qty", () => {
    const cart: CartLine[] = [{ itemId: ID1, qty: 3.7 as unknown as number }];
    const lines = sanitizeCartLines(cart, known);
    expect(lines).toHaveLength(1);
    expect(lines[0].qty).toBe(3);
  });

  it("drops qty 0, negative, over 50, and NaN", () => {
    const cart: CartLine[] = [
      { itemId: ID1, qty: 0 },
      { itemId: ID1, qty: -1 },
      { itemId: ID1, qty: 51 },
      { itemId: ID1, qty: "abc" as unknown as number },
    ];
    expect(sanitizeCartLines(cart, known)).toHaveLength(0);
  });

  it("drops unknown items", () => {
    const cart: CartLine[] = [{ itemId: "99999999-9999-9999-9999-999999999999", qty: 1 }];
    expect(sanitizeCartLines(cart, known)).toHaveLength(0);
  });

  it("keeps qty exactly 50", () => {
    const cart: CartLine[] = [{ itemId: ID1, qty: 50 }];
    const lines = sanitizeCartLines(cart, known);
    expect(lines).toHaveLength(1);
    expect(lines[0].qty).toBe(50);
  });
});
