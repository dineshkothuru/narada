// Cancellation is a product rule, kept free of database and HTTP concerns.
export type ItemStatus = "queued" | "preparing" | "ready" | "served" | "cancelled";

export function guestMayRemove(status: string): boolean {
  return status === "queued";
}

export function staffMayVoid(status: string): boolean {
  return status === "queued" || status === "preparing" || status === "ready";
}
