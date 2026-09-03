import { describe, expect, it } from "vitest";
import { guestMayRemove, staffMayVoid } from "../src/cancel-rules";

describe("cancellation rules", () => {
  it("lets guests remove queued dishes only", () => {
    expect(guestMayRemove("queued")).toBe(true);
    expect(guestMayRemove("preparing")).toBe(false);
    expect(guestMayRemove("served")).toBe(false);
  });

  it("lets staff void before service, but not after or twice", () => {
    expect(staffMayVoid("queued")).toBe(true);
    expect(staffMayVoid("preparing")).toBe(true);
    expect(staffMayVoid("ready")).toBe(true);
    expect(staffMayVoid("served")).toBe(false);
    expect(staffMayVoid("cancelled")).toBe(false);
  });
});
