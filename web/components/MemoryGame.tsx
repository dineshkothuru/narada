"use client";

import { useEffect, useRef, useState } from "react";
import { MEMORY_EMOJIS, MEMORY_LEVELS } from "@/lib/games";

type Card = { id: number; emoji: string; matched: boolean };

function buildDeck(pairs: number): Card[] {
  const emojis = [...MEMORY_EMOJIS].sort(() => Math.random() - 0.5).slice(0, pairs);
  return [...emojis, ...emojis]
    .map((emoji, id) => ({ id, emoji, matched: false }))
    .sort(() => Math.random() - 0.5);
}

export default function MemoryGame({
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
