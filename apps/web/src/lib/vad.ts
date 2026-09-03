// Voice-activity thresholds for the hands-free mic loop, kept pure so the
// stop conditions can be tested without a MediaRecorder.
export const VAD = {
  tickMs: 100,
  speechRms: 0.02,
  trailingSilenceMs: 900,
  maxTurnMs: 15000,
  noSpeechTimeoutMs: 20000,
} as const;

export function rmsOf(data: Uint8Array): number {
  let sum = 0;
  for (let i = 0; i < data.length; i++) {
    const v = (data[i] - 128) / 128;
    sum += v * v;
  }
  return Math.sqrt(sum / data.length);
}

// The orb's scale tracks loudness; clamp so a shout does not blow up the layout.
export function levelFromRms(rms: number): number {
  return Math.min(1, rms * 8);
}

export type VadState = { spoke: boolean; silentMs: number; totalMs: number };

export function stepVad(state: VadState, rms: number, tickMs = VAD.tickMs): VadState {
  const totalMs = state.totalMs + tickMs;
  if (rms > VAD.speechRms) return { spoke: true, silentMs: 0, totalMs };
  return { spoke: state.spoke, silentMs: state.silentMs + tickMs, totalMs };
}

// Why the turn ended matters: "silence with no speech at all" closes the dock,
// everything else sends what was captured.
export function turnEnded(state: VadState): boolean {
  const doneSpeaking = state.spoke && state.silentMs > VAD.trailingSilenceMs;
  const tooLong = state.totalMs > VAD.maxTurnMs;
  const nothingSaid = !state.spoke && state.totalMs > VAD.noSpeechTimeoutMs;
  return doneSpeaking || tooLong || nothingSaid;
}
