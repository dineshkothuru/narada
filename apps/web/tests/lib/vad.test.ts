import { describe, expect, it } from "vitest";
import { VAD, levelFromRms, rmsOf, stepVad, turnEnded, type VadState } from "../../src/lib/vad";

const silent: VadState = { spoke: false, silentMs: 0, totalMs: 0 };

describe("rmsOf", () => {
  it("is zero for a flat signal at the 128 midpoint", () => {
    expect(rmsOf(new Uint8Array(64).fill(128))).toBe(0);
  });

  it("grows with amplitude", () => {
    const quiet = rmsOf(new Uint8Array(64).fill(130));
    const loud = rmsOf(new Uint8Array(64).fill(200));
    expect(loud).toBeGreaterThan(quiet);
  });
});

describe("levelFromRms", () => {
  it("clamps a shout to 1", () => {
    expect(levelFromRms(0.9)).toBe(1);
  });

  it("scales quiet speech into the orb's range", () => {
    expect(levelFromRms(0.05)).toBeCloseTo(0.4);
  });
});

describe("stepVad", () => {
  it("marks speech and clears the silence run above the threshold", () => {
    const next = stepVad({ spoke: false, silentMs: 500, totalMs: 500 }, VAD.speechRms + 0.01);
    expect(next).toEqual({ spoke: true, silentMs: 0, totalMs: 600 });
  });

  it("accumulates silence below the threshold without unsetting spoke", () => {
    const next = stepVad({ spoke: true, silentMs: 100, totalMs: 100 }, 0);
    expect(next).toEqual({ spoke: true, silentMs: 200, totalMs: 200 });
  });
});

describe("turnEnded", () => {
  it("keeps listening while the guest is still talking", () => {
    expect(turnEnded({ spoke: true, silentMs: 300, totalMs: 3000 })).toBe(false);
  });

  it("ends on a trailing pause after speech", () => {
    expect(turnEnded({ spoke: true, silentMs: VAD.trailingSilenceMs + 100, totalMs: 4000 })).toBe(
      true,
    );
  });

  it("cuts off a turn that runs too long", () => {
    expect(turnEnded({ spoke: true, silentMs: 0, totalMs: VAD.maxTurnMs + 100 })).toBe(true);
  });

  it("gives up after a long silence with nothing said", () => {
    expect(turnEnded({ ...silent, totalMs: VAD.noSpeechTimeoutMs + 100 })).toBe(true);
  });

  it("waits out a short silence before anyone speaks", () => {
    expect(turnEnded({ ...silent, totalMs: 5000, silentMs: 5000 })).toBe(false);
  });
});
