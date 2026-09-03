"use client";

import { useEffect, useRef, useState } from "react";
import { WHEEL } from "@/lib/games";

const SLICE_DEG = 360 / WHEEL.length;

function sliceArc(index: number, r: number, cx: number, cy: number): string {
  const start = ((index * SLICE_DEG - 90) * Math.PI) / 180;
  const end = (((index + 1) * SLICE_DEG - 90) * Math.PI) / 180;
  const x1 = cx + r * Math.cos(start);
  const y1 = cy + r * Math.sin(start);
  const x2 = cx + r * Math.cos(end);
  const y2 = cy + r * Math.sin(end);
  return `M ${cx} ${cy} L ${x1} ${y1} A ${r} ${r} 0 0 1 ${x2} ${y2} Z`;
}

// The prize is drawn SERVER-side (resolveSpin returns the slice index);
// this component only animates the wheel landing on it.
export default function SpinWheel({
  strings,
  resolveSpin,
  onResult,
}: {
  strings: { spin: string };
  resolveSpin: () => Promise<number>;
  onResult: (index: number) => void;
}) {
  const [deg, setDeg] = useState(0);
  const [spinning, setSpinning] = useState(false);
  const [done, setDone] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(
    () => () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    },
    [],
  );

  const spin = async () => {
    if (spinning || done) return;
    setSpinning(true);
    let idx: number;
    try {
      idx = await resolveSpin();
    } catch {
      setSpinning(false);
      return;
    }
    // land the middle of slice idx under the top pointer, plus 5 full turns
    const target = 360 * 5 + (360 - (idx * SLICE_DEG + SLICE_DEG / 2));
    setDeg(target);
    timerRef.current = setTimeout(() => {
      setSpinning(false);
      setDone(true);
      onResult(idx);
    }, 4200);
  };

  return (
    <div className="flex flex-col items-center">
      <div className="relative">
        <div className="absolute -top-1 left-1/2 z-10 -translate-x-1/2 text-2xl drop-shadow">
          🔻
        </div>
        <svg
          viewBox="0 0 260 260"
          className="h-64 w-64"
          style={{
            transform: `rotate(${deg}deg)`,
            transition: spinning ? "transform 4.2s cubic-bezier(0.15, 0.9, 0.28, 1)" : undefined,
          }}
        >
          {WHEEL.map((s, i) => (
            <path
              key={i}
              d={sliceArc(i, 124, 130, 130)}
              fill={s.color}
              stroke="#fff"
              strokeWidth="2"
            />
          ))}
          {WHEEL.map((s, i) => {
            const mid = ((i * SLICE_DEG + SLICE_DEG / 2 - 90) * Math.PI) / 180;
            const tx = 130 + 80 * Math.cos(mid);
            const ty = 130 + 80 * Math.sin(mid);
            return (
              <text
                key={i}
                x={tx}
                y={ty}
                textAnchor="middle"
                dominantBaseline="middle"
                fontSize="11"
                fontWeight="700"
                fill="#fff"
                transform={`rotate(${i * SLICE_DEG + SLICE_DEG / 2} ${tx} ${ty})`}
              >
                <tspan x={tx} dy="-6">
                  {s.emoji}
                </tspan>
                <tspan x={tx} dy="13">
                  {s.label}
                </tspan>
              </text>
            );
          })}
          <circle cx="130" cy="130" r="24" fill="#1c1c1c" />
          <text x="130" y="130" textAnchor="middle" dominantBaseline="central" fontSize="16">
            🎡
          </text>
        </svg>
      </div>
      {!done && (
        <button
          onClick={spin}
          disabled={spinning}
          className="mt-4 rounded-full bg-rose-600 px-10 py-3 text-sm font-bold text-white shadow-lg transition active:scale-95 disabled:opacity-60"
        >
          {strings.spin}
        </button>
      )}
    </div>
  );
}
