import { describe, expect, it } from "vitest";
import type { CartLine, MenuItem } from "@narada/shared";
import {
  addQty,
  applyDiscount,
  cartTotal,
  changeQty,
  itemCount,
  payableFor,
  qtyOf,
  removeLine,
  setQty,
  uniqueGuestName,
  upiLink,
} from "../../src/lib/cartMath";

function item(id: string, priceInr: number): MenuItem {
  return {
    id,
    categoryId: "mains",
    name: { en: id, hi: id, te: id },
    description: { en: "", hi: "", te: "" },
    priceInr,
    isVeg: true,
    spiceLevel: 0,
    allergens: [],
    tags: [],
    emoji: "🍛",
    imageUrl: null,
    isAvailable: true,
  };
}

const MENU = new Map<string, MenuItem>([
  ["dosa", item("dosa", 120)],
  ["lassi", item("lassi", 80)],
]);

describe("changeQty", () => {
  it("adds a new line when the item is not in the cart", () => {
    expect(changeQty([], "dosa", 1)).toEqual([{ itemId: "dosa", qty: 1, notes: undefined }]);
  });

  it("ignores a decrement for an item that is not in the cart", () => {
    const cart: CartLine[] = [];
    expect(changeQty(cart, "dosa", -1)).toBe(cart);
  });

  it("increments an existing line", () => {
    expect(changeQty([{ itemId: "dosa", qty: 2 }], "dosa", 1)).toEqual([
      { itemId: "dosa", qty: 3, notes: undefined },
    ]);
  });

  it("drops the line when the quantity reaches zero", () => {
    expect(changeQty([{ itemId: "dosa", qty: 1 }], "dosa", -1)).toEqual([]);
  });

  it("keeps the existing note when none is supplied", () => {
    expect(changeQty([{ itemId: "dosa", qty: 1, notes: "no onion" }], "dosa", 1)).toEqual([
      { itemId: "dosa", qty: 2, notes: "no onion" },
    ]);
  });
});

describe("setQty / addQty / removeLine", () => {
  it("setQty removes the line at zero or below", () => {
    expect(setQty([{ itemId: "dosa", qty: 3 }], "dosa", 0)).toEqual([]);
    expect(setQty([{ itemId: "dosa", qty: 3 }], "dosa", -2)).toEqual([]);
  });

  it("setQty appends when the item is absent", () => {
    expect(setQty([], "lassi", 2)).toEqual([{ itemId: "lassi", qty: 2 }]);
  });

  it("addQty sums onto an existing line", () => {
    expect(addQty([{ itemId: "dosa", qty: 1 }], "dosa", 2)).toEqual([
      { itemId: "dosa", qty: 3, notes: undefined },
    ]);
  });

  it("removeLine drops only the named item", () => {
    const cart = [
      { itemId: "dosa", qty: 1 },
      { itemId: "lassi", qty: 2 },
    ];
    expect(removeLine(cart, "dosa")).toEqual([{ itemId: "lassi", qty: 2 }]);
  });
});

describe("totals", () => {
  const cart = [
    { itemId: "dosa", qty: 2 },
    { itemId: "lassi", qty: 1 },
  ];

  it("counts every unit, not every line", () => {
    expect(itemCount(cart)).toBe(3);
  });

  it("prices the cart from the menu", () => {
    expect(cartTotal(cart, MENU)).toBe(320);
  });

  it("prices an unknown item as zero rather than NaN", () => {
    expect(cartTotal([{ itemId: "ghost", qty: 4 }], MENU)).toBe(0);
  });

  it("qtyOf reports zero for an absent item", () => {
    expect(qtyOf(cart, "ghost")).toBe(0);
    expect(qtyOf(cart, "dosa")).toBe(2);
  });

  it("rounds the discounted total", () => {
    expect(applyDiscount(320, 15)).toBe(272);
    expect(applyDiscount(0, 10)).toBe(0);
    expect(applyDiscount(105, 5)).toBe(100);
  });
});

describe("payableFor", () => {
  it("prefers the server bill over any local arithmetic", () => {
    expect(
      payableFor({ billNet: 411, orderTotal: 320, rounds: [{ total_inr: 320 }], discountPct: 10 }),
    ).toBe(411);
  });

  it("sums the placed rounds and applies the spin discount", () => {
    expect(
      payableFor({
        billNet: null,
        orderTotal: 100,
        rounds: [{ total_inr: 200 }, { total_inr: 100 }],
        discountPct: 10,
      }),
    ).toBe(270);
  });

  it("falls back to the single order snapshot when no rounds have arrived", () => {
    expect(payableFor({ billNet: null, orderTotal: 200, rounds: [], discountPct: 5 })).toBe(190);
  });

  it("is zero before anything is placed", () => {
    expect(payableFor({ billNet: null, orderTotal: null, rounds: [], discountPct: 0 })).toBe(0);
  });
});

describe("uniqueGuestName", () => {
  it("keeps a free name as typed", () => {
    expect(uniqueGuestName("Ravi", ["Anita"])).toBe("Ravi");
  });

  it("suffixes a name already taken on the table", () => {
    expect(uniqueGuestName("Ravi", ["ravi"])).toBe("Ravi 2");
    expect(uniqueGuestName("Ravi", ["Ravi", "Ravi 2"])).toBe("Ravi 3");
  });

  it("returns empty for a blank name", () => {
    expect(uniqueGuestName("   ", [])).toBe("");
  });

  it("caps the base name at 30 characters", () => {
    expect(uniqueGuestName("x".repeat(40), [])).toHaveLength(30);
  });
});

describe("upiLink", () => {
  it("encodes the payee and the table note", () => {
    const link = upiLink({
      vpa: "demo@upi",
      payeeName: "Spice Garden",
      amount: 272,
      tableCode: "t1-demo",
    });
    expect(link).toBe(
      "upi://pay?pa=demo%40upi&pn=Spice%20Garden&am=272&cu=INR&tn=Narada%20t1-demo",
    );
  });
});
