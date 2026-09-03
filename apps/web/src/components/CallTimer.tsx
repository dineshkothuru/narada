import { useEffect, useState } from "react";

// Live "waiting for XX:XX" counter that escalates in colour so a call is
// impossible to miss: amber after 1 min, red + pulse after 2.
export default function CallTimer({
  since,
  compact = false,
}: {
  since: string;
  compact?: boolean;
}) {
  const [secs, setSecs] = useState(() =>
    Math.max(0, Math.floor((Date.now() - new Date(since).getTime()) / 1000)),
  );

  useEffect(() => {
    const tick = () =>
      setSecs(Math.max(0, Math.floor((Date.now() - new Date(since).getTime()) / 1000)));
    tick();
    const iv = setInterval(tick, 1000);
    return () => clearInterval(iv);
  }, [since]);

  const mm = String(Math.floor(secs / 60)).padStart(2, "0");
  const ss = String(secs % 60).padStart(2, "0");
  const level = secs >= 120 ? "late" : secs >= 60 ? "warn" : "fresh";
  const style =
    level === "late"
      ? "animate-pulse bg-rose-600 text-white"
      : level === "warn"
        ? "bg-amber-400 text-stone-900"
        : "bg-stone-900 text-white";

  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full font-mono font-extrabold tabular-nums ${style} ${
        compact ? "px-2 py-0.5 text-[10px]" : "px-3 py-1 text-xs"
      }`}
      title="time since the guest called"
    >
      🔔 {mm}:{ss}
    </span>
  );
}
