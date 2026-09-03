// The two state machines the staff screens run on. Both were inline in their
// API routes, where the only way to exercise them was to place a real order.

export type ItemStatus = "queued" | "preparing" | "ready" | "served";
export type OrderStatus = "placed" | "preparing" | "ready" | "served";
export type TableStatus = "free" | "cleaning" | "seated" | "dining" | "settling" | "paid";

// A ticket is only as advanced as its least advanced dish: every dish served
// means the round is served, every dish at least ready means it can go out,
// and any dish touched at all means the kitchen has started.
export function deriveOrderStatus(items: { status: string }[]): OrderStatus {
  if (items.length === 0) return "placed";
  if (items.every((s) => s.status === "served")) return "served";
  if (items.every((s) => s.status === "served" || s.status === "ready")) return "ready";
  if (items.some((s) => s.status !== "queued")) return "preparing";
  return "placed";
}

// A table with no open tab is free — unless the last party's bill was settled
// and nobody has cleared the table yet. With a tab: nothing ordered is still
// "seated", unserved rounds mean "dining", and once everything is served the
// table is either owing money or fully paid.
export function deriveTableStatus(t: {
  hasSession: boolean;
  needsCleaning: boolean;
  rounds: number;
  pending: number;
  due: number;
}): TableStatus {
  if (!t.hasSession) return t.needsCleaning ? "cleaning" : "free";
  if (t.rounds === 0) return "seated";
  if (t.pending > 0) return "dining";
  return t.due > 0 ? "settling" : "paid";
}
