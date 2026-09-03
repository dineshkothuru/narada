import type { CartLine, MenuItem } from "@narada/shared";

// Cart arithmetic lifted out of OrderExperience so the add/remove/qty rules and
// the discounted totals can be tested without rendering the whole menu.

export function changeQty(cart: CartLine[], itemId: string, delta: number, notes?: string) {
  const line = cart.find((l) => l.itemId === itemId);
  if (!line) {
    return delta > 0 ? [...cart, { itemId, qty: delta, notes }] : cart;
  }
  const qty = line.qty + delta;
  if (qty <= 0) return cart.filter((l) => l.itemId !== itemId);
  return cart.map((l) => (l.itemId === itemId ? { ...l, qty, notes: notes ?? l.notes } : l));
}

export function setQty(cart: CartLine[], itemId: string, qty: number) {
  if (qty <= 0) return cart.filter((l) => l.itemId !== itemId);
  if (!cart.some((l) => l.itemId === itemId)) return [...cart, { itemId, qty }];
  return cart.map((l) => (l.itemId === itemId ? { ...l, qty } : l));
}

export function addQty(cart: CartLine[], itemId: string, qty: number, notes?: string) {
  const line = cart.find((l) => l.itemId === itemId);
  return line
    ? cart.map((l) =>
        l.itemId === itemId ? { ...l, qty: l.qty + qty, notes: notes ?? l.notes } : l,
      )
    : [...cart, { itemId, qty, notes }];
}

export function removeLine(cart: CartLine[], itemId: string) {
  return cart.filter((l) => l.itemId !== itemId);
}

export function qtyOf(cart: CartLine[], itemId: string) {
  return cart.find((l) => l.itemId === itemId)?.qty ?? 0;
}

export function itemCount(cart: CartLine[]) {
  return cart.reduce((n, l) => n + l.qty, 0);
}

export function cartTotal(cart: CartLine[], menuById: Map<string, MenuItem>) {
  return cart.reduce((sum, l) => sum + (menuById.get(l.itemId)?.priceInr ?? 0) * l.qty, 0);
}

export function applyDiscount(total: number, discountPct: number) {
  return Math.round(total * (1 - discountPct / 100));
}

// What the guest owes: a server bill wins; otherwise the placed rounds (or the
// single order's snapshot) with the spin discount taken off.
export function payableFor({
  billNet,
  orderTotal,
  rounds,
  discountPct,
}: {
  billNet: number | null;
  orderTotal: number | null;
  rounds: { total_inr: number }[];
  discountPct: number;
}) {
  if (billNet !== null) return billNet;
  if (orderTotal === null) return 0;
  const gross = rounds.length ? rounds.reduce((s, r) => s + Number(r.total_inr), 0) : orderTotal;
  return applyDiscount(gross, discountPct);
}

export function upiLink({
  vpa,
  payeeName,
  amount,
  tableCode,
}: {
  vpa: string;
  payeeName: string;
  amount: number;
  tableCode: string;
}) {
  return `upi://pay?pa=${encodeURIComponent(vpa)}&pn=${encodeURIComponent(
    payeeName,
  )}&am=${amount}&cu=INR&tn=${encodeURIComponent(`Narada ${tableCode}`)}`;
}

// Dedupe a name against the ones already on the table's other rounds: Ravi → Ravi 2
export function uniqueGuestName(base: string, takenNames: (string | null | undefined)[]) {
  const trimmed = base.trim().slice(0, 30);
  if (!trimmed) return "";
  const taken = new Set(takenNames.filter(Boolean).map((n) => n!.toLowerCase()));
  let candidate = trimmed;
  for (let n = 2; taken.has(candidate.toLowerCase()); n++) {
    candidate = `${trimmed} ${n}`;
  }
  return candidate;
}
