import { describe, expect, it } from "vitest";
import { deriveOrderStatus, deriveTableStatus } from "@/lib/status";

const items = (...statuses: string[]) => statuses.map((status) => ({ status }));

describe("deriveOrderStatus", () => {
  it("is placed while every dish is still queued", () => {
    expect(deriveOrderStatus(items("queued", "queued"))).toBe("placed");
  });

  it("is preparing as soon as the kitchen starts a single dish", () => {
    expect(deriveOrderStatus(items("preparing", "queued"))).toBe("preparing");
  });

  it("stays preparing while one dish lags, even if another is ready", () => {
    expect(deriveOrderStatus(items("ready", "queued"))).toBe("preparing");
  });

  it("is ready only when every dish is ready or already served", () => {
    expect(deriveOrderStatus(items("ready", "ready"))).toBe("ready");
    expect(deriveOrderStatus(items("ready", "served"))).toBe("ready");
  });

  it("is served only when every dish reached the table", () => {
    expect(deriveOrderStatus(items("served", "served"))).toBe("served");
    expect(deriveOrderStatus(items("served", "ready"))).not.toBe("served");
  });

  it("treats an empty ticket as placed rather than served", () => {
    // [].every(...) is true, so a naive check would call an empty round "served"
    expect(deriveOrderStatus([])).toBe("placed");
  });
});

describe("deriveTableStatus", () => {
  const t = (over: Partial<Parameters<typeof deriveTableStatus>[0]>) =>
    deriveTableStatus({
      hasSession: true,
      needsCleaning: false,
      rounds: 0,
      pending: 0,
      due: 0,
      billRaised: false,
      ...over,
    });

  it("is free with no tab and nothing to clean", () => {
    expect(t({ hasSession: false })).toBe("free");
  });

  it("is cleaning after the bill is settled until a waiter clears it", () => {
    expect(t({ hasSession: false, needsCleaning: true })).toBe("cleaning");
  });

  it("does not offer a table that still needs cleaning as free", () => {
    expect(t({ hasSession: false, needsCleaning: true })).not.toBe("free");
  });

  it("is seated, not ready to settle, before anything is ordered", () => {
    expect(t({ rounds: 0, pending: 0, due: 0 })).toBe("seated");
  });

  it("is dining while any round is unserved", () => {
    expect(t({ rounds: 3, pending: 1, due: 900 })).toBe("dining");
  });

  it("needs a bill once everything is served and money is owed", () => {
    expect(t({ rounds: 3, pending: 0, due: 900 })).toBe("settling");
  });

  it("is billed once the counter has raised the invoice", () => {
    // raising the bill and paying it are different people's jobs, so they are
    // different states — the floor must not show one as the other
    expect(t({ rounds: 3, pending: 0, due: 900, billRaised: true })).toBe("billed");
  });

  it("is paid once nothing is owed, however the bill was raised", () => {
    expect(t({ rounds: 3, pending: 0, due: 0, billRaised: true })).toBe("paid");
    expect(t({ rounds: 3, pending: 0, due: 0, billRaised: false })).toBe("paid");
  });

  it("does not call a table billed while food is still coming", () => {
    expect(t({ rounds: 3, pending: 1, due: 900, billRaised: true })).toBe("dining");
  });

  it("is paid when everything is served and nothing is owed", () => {
    expect(t({ rounds: 3, pending: 0, due: 0 })).toBe("paid");
  });

  it("ignores cleaning while a party is still seated", () => {
    expect(t({ needsCleaning: true, rounds: 2, pending: 1, due: 500 })).toBe("dining");
  });
});
