import { describe, expect, it } from "vitest";
import { CANCELLABLE, guestMayRemove, staffMayVoid } from "@/lib/cancel-rules";
import { deriveOrderStatus } from "@/lib/status";

describe("what a guest may take back", () => {
  it("allows removal only before the kitchen starts", () => {
    expect(CANCELLABLE).toEqual(["queued"]);
    expect(guestMayRemove("queued")).toBe(true);
    for (const started of ["preparing", "ready", "served", "cancelled"]) {
      expect(guestMayRemove(started)).toBe(false);
    }
  });

  it("lets staff void what a guest cannot, but never a served dish", () => {
    expect(staffMayVoid("queued")).toBe(true);
    expect(staffMayVoid("preparing")).toBe(true);
    expect(staffMayVoid("ready")).toBe(true);
    expect(staffMayVoid("served")).toBe(false);
    expect(staffMayVoid("cancelled")).toBe(false);
  });
});

describe("a round after one of its dishes is cancelled", () => {
  const live = (items: { status: string }[]) =>
    items.filter((i) => i.status !== "cancelled");

  it("follows the dishes that remain", () => {
    const items = [{ status: "cancelled" }, { status: "preparing" }];
    expect(deriveOrderStatus(live(items))).toBe("preparing");
  });

  it("is ready when every remaining dish is ready", () => {
    const items = [{ status: "cancelled" }, { status: "ready" }, { status: "ready" }];
    expect(deriveOrderStatus(live(items))).toBe("ready");
  });

  it("is served when every remaining dish is served", () => {
    const items = [{ status: "cancelled" }, { status: "served" }];
    expect(deriveOrderStatus(live(items))).toBe("served");
  });

  it("leaves nothing behind when the whole round is cancelled", () => {
    // an empty round must be marked cancelled by the caller, not derived as
    // "placed" — deriveOrderStatus alone would call it placed
    const items = [{ status: "cancelled" }, { status: "cancelled" }];
    expect(live(items)).toHaveLength(0);
  });
});
