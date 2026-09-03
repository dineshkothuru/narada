// Who may take a dish off the bill, and when. Pure so it can be tested and
// reused by the client without dragging the database layer along.

export type ItemStatus = "queued" | "preparing" | "ready" | "served" | "cancelled";

/** A guest may only remove what the kitchen has not started. */
export const CANCELLABLE: readonly ItemStatus[] = ["queued"];

export function guestMayRemove(status: string): boolean {
  return (CANCELLABLE as readonly string[]).includes(status);
}

// Staff can void a dish the kitchen has already started — a deliberate
// decision, recorded — but never one that has already reached the table.
export function staffMayVoid(status: string): boolean {
  return status !== "served" && status !== "cancelled";
}
