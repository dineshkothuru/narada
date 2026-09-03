import { useState } from "react";

const SWEETNESS = ["", "Less sweet", "Regular", "Extra sweet"];

// chillies on a mango juice read as nonsense — a drink's 0-3 intensity is
// how sweet it is, so it gets words instead of peppers
export function SpiceDots({ level, kind }: { level: number; kind?: "food" | "drink" }) {
  if (level === 0) return null;
  if (kind === "drink") {
    return (
      <span className="text-[10px] font-semibold text-stone-400">
        {SWEETNESS[Math.min(level, 3)]}
      </span>
    );
  }
  return (
    <span className="text-[10px] tracking-tight" aria-label={`spice level ${level}`}>
      {"🌶️".repeat(level)}
    </span>
  );
}

export function VegMark({ isVeg }: { isVeg: boolean }) {
  return (
    <span
      className={`inline-flex h-3.5 w-3.5 items-center justify-center rounded-[3px] border ${
        isVeg ? "border-green-600" : "border-red-600"
      }`}
    >
      <span className={`h-1.5 w-1.5 rounded-full ${isVeg ? "bg-green-600" : "bg-red-600"}`} />
    </span>
  );
}

export function ItemPhoto({
  imageUrl,
  emoji,
  alt,
  className,
}: {
  imageUrl: string | null;
  emoji: string;
  alt: string;
  className: string;
}) {
  const [broken, setBroken] = useState(false);
  if (imageUrl && !broken) {
    return (
      <img
        src={imageUrl}
        alt={alt}
        loading="lazy"
        onError={() => setBroken(true)}
        className={`${className} object-cover`}
      />
    );
  }
  return (
    <div className={`${className} grid place-items-center bg-stone-100 text-4xl`}>{emoji}</div>
  );
}
