"use client";

import { useEffect, useRef, useState } from "react";
import { MEMORY_EMOJIS, MEMORY_LEVELS } from "@/lib/games";

type Card = { id: number; emoji: string; matched: boolean };

function buildDeck(pairs: number): Card[] {
  const emojis = [...MEMORY_EMOJIS]
    .sort(() => Math.random() - 0.5)
    .slice(0, pairs);
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
  const [levelClear, setLevelClear] = useState(false);
  const lockRef = useRef(false);
  const doneRef = useRef(false);

  useEffect(() => {
    if (deck.length > 0 && deck.every((c) => c.matched) && !levelClear) {
      setLevelClear(true);
      if (level === MEMORY_LEVELS.length - 1 && !doneRef.current) {
        doneRef.current = true;
        onAllLevelsComplete();
      }
    }
  }, [deck, level, levelClear, onAllLevelsComplete]);

  const flip = (idx: number) => {
    if (lockRef.current || deck[idx].matched || flipped.includes(idx)) return;
    const next = [...flipped, idx];
    setFlipped(next);
    if (next.length === 2) {
      setMoves((m) => m + 1);
      const [a, b] = next;
      if (deck[a].emoji === deck[b].emoji) {
        setDeck((d) =>
          d.map((c, i) => (i === a || i === b ? { ...c, matched: true } : c)),
        );
        setFlipped([]);
      } else {
        lockRef.current = true;
        setTimeout(() => {
          setFlipped([]);
          lockRef.current = false;
        }, 750);
      }
    }
  };

  const nextLevel = () => {
    const n = level + 1;
    if (n >= MEMORY_LEVELS.length) return;
    setLevel(n);
    setDeck(buildDeck(MEMORY_LEVELS[n].pairs));
    setFlipped([]);
    setMoves(0);
    setLevelClear(false);
  };

  return (
    <div className="w-full rounded-2xl bg-violet-50 p-4 ring-1 ring-violet-200">
      <div className="flex items-center justify-between text-[11px] font-bold tracking-widest text-violet-500 uppercase">
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
                    : "bg-white ring-1 ring-violet-300"
                  : "bg-gradient-to-br from-violet-500 to-fuchsia-500 active:scale-95"
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
          className="animate-pop mt-3 w-full rounded-xl bg-violet-600 px-4 py-3 text-sm font-bold text-white transition active:scale-[0.98]"
        >
          {strings.levelClear} {strings.nextLevel}
        </button>
      )}
    </div>
  );
}
