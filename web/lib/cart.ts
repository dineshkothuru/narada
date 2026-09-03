import type { CartLine } from "./types";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// itemIds are client input — only well-formed uuids may enter the filter
export function validItemIds(cart: CartLine[]): string[] {
  return [...new Set(cart.map((l) => l.itemId))].filter((id) => UUID.test(id));
}

export function sanitizeCartLines(cart: CartLine[], known: Set<string>): CartLine[] {
  return cart
    .map((l) => ({ ...l, qty: Math.floor(Number(l.qty)) }))
    .filter((l) => known.has(l.itemId) && l.qty > 0 && l.qty <= 50);
}
