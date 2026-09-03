import { useEffect, useRef, useState } from "react";
import { MEMORY_EMOJIS, MEMORY_LEVELS, WHEEL } from "@narada/shared";

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
export function SpinWheel({
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

type Card = { id: number; emoji: string; matched: boolean };

function buildDeck(pairs: number): Card[] {
  const emojis = [...MEMORY_EMOJIS].sort(() => Math.random() - 0.5).slice(0, pairs);
  return [...emojis, ...emojis]
    .map((emoji, id) => ({ id, emoji, matched: false }))
    .sort(() => Math.random() - 0.5);
}

// Post-order waiting game: clear every level and the kitchen sends a freebie.
export function MemoryGame({
  strings,
  onAllLevelsComplete,
}: {
  strings: { level: string; moves: string; levelClear: string; nextLevel: string };
  onAllLevelsComplete: () => void;
}) {
  const [level, setLevel] = useState(0);
  const [deck, setDeck] = useState<Card[]>(() => buildDeck(MEMORY_LEVELS[0].pairs));
  const [flipped, setFlipped] = useState<number[]>([]);
  const [moves, setMoves] = useState(0);
  const lockRef = useRef(false);
  const doneRef = useRef(false);
  const flippedRef = useRef<number[]>([]);
  const levelClear = deck.length > 0 && deck.every((c) => c.matched);

  const setFlippedSafe = (next: number[]) => {
    flippedRef.current = next;
    setFlipped(next);
  };

  const nextLevel = () => {
    const n = level + 1;
    if (n >= MEMORY_LEVELS.length) return;
    setLevel(n);
    setDeck(buildDeck(MEMORY_LEVELS[n].pairs));
    setFlippedSafe([]);
    setMoves(0);
    lockRef.current = false;
  };

  // completion + auto-advance react to the derived levelClear flag
  useEffect(() => {
    if (!levelClear) return;
    if (level === MEMORY_LEVELS.length - 1) {
      if (!doneRef.current) {
        doneRef.current = true;
        onAllLevelsComplete();
      }
      return;
    }
    const timer = setTimeout(nextLevel, 1500);
    return () => clearTimeout(timer);
    // deliberately not depending on nextLevel/onAllLevelsComplete: this must fire
    // once per cleared level, not again when the parent re-renders a new callback
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [levelClear, level]);

  const flip = (idx: number) => {
    const prev = flippedRef.current;
    if (lockRef.current || deck[idx].matched || prev.includes(idx) || prev.length >= 2) {
      return;
    }
    const next = [...prev, idx];
    setFlippedSafe(next);
    if (next.length === 2) {
      setMoves((m) => m + 1);
      const [a, b] = next;
      if (deck[a].emoji === deck[b].emoji) {
        setDeck((d) => d.map((c, i) => (i === a || i === b ? { ...c, matched: true } : c)));
        setFlippedSafe([]);
      } else {
        lockRef.current = true;
        setTimeout(() => {
          setFlippedSafe([]);
          lockRef.current = false;
        }, 750);
      }
    }
  };

  return (
    <div className="w-full rounded-2xl bg-white p-4 ring-1 ring-stone-200">
      <div className="flex items-center justify-between text-[11px] font-bold tracking-widest text-stone-500 uppercase">
        <span>
          {strings.level} {level + 1}/{MEMORY_LEVELS.length}
        </span>
        <span>
          {strings.moves}: {moves}
        </span>
      </div>
      <div
        className="mt-3 grid gap-2"
        style={{
          gridTemplateColumns: `repeat(${MEMORY_LEVELS[level].cols}, minmax(0,1fr))`,
        }}
      >
        {deck.map((card, i) => {
          const shown = card.matched || flipped.includes(i);
          return (
            <button
              key={card.id}
              onClick={() => flip(i)}
              className={`grid aspect-square place-items-center rounded-xl text-2xl transition-all duration-200 ${
                shown
                  ? card.matched
                    ? "bg-green-100 ring-1 ring-green-300"
                    : "bg-white ring-1 ring-stone-300"
                  : "bg-gradient-to-br from-stone-800 to-stone-900 text-rose-400 active:scale-95"
              }`}
            >
              {shown ? card.emoji : "✦"}
            </button>
          );
        })}
      </div>
      {levelClear && level < MEMORY_LEVELS.length - 1 && (
        <button
          onClick={nextLevel}
          className="animate-pop mt-3 w-full rounded-xl bg-rose-600 px-4 py-3 text-sm font-bold text-white transition active:scale-[0.98]"
        >
          {strings.levelClear} {strings.nextLevel}
        </button>
      )}
      {levelClear && level === MEMORY_LEVELS.length - 1 && (
        <p className="animate-pop mt-3 text-center text-sm font-bold text-green-600">🎉</p>
      )}
    </div>
  );
}
