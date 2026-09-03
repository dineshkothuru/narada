"use client";

import Link from "next/link";
import CallTimer from "./CallTimer";

export type OpenCall = {
  id: string;
  label: string;
  since: string;
  attendant: string | null;
};

// Impossible-to-miss red bar across the top of every staff screen: each
// calling table scrolls past with its live timer. Tapping goes to the waiter
// screen where the call can be attended.
export default function CallAlertBar({ calls }: { calls: OpenCall[] }) {
  if (calls.length === 0) return null;

  // duplicate the run so the marquee loops seamlessly
  const run = [...calls, ...calls];

  return (
    <Link
      href="/waiter"
      className="sticky top-0 z-30 block overflow-hidden bg-rose-600 py-2 text-white shadow-lg"
    >
      <div className="flex items-center gap-3">
        <span className="z-10 flex shrink-0 items-center gap-1.5 bg-rose-600 pr-3 pl-4 text-xs font-extrabold tracking-wider uppercase">
          <span className="inline-block h-2 w-2 animate-ping rounded-full bg-white" />
          {calls.length} calling
        </span>
        <span className="animate-marquee flex w-max gap-8">
          {run.map((c, i) => (
            <span key={`${c.id}-${i}`} className="flex items-center gap-2 whitespace-nowrap">
              <span className="text-sm font-bold">🔔 {c.label}</span>
              <CallTimer since={c.since} compact />
              {c.attendant && (
                <span className="text-[11px] font-semibold text-rose-100">· {c.attendant}</span>
              )}
            </span>
          ))}
        </span>
      </div>
    </Link>
  );
}
